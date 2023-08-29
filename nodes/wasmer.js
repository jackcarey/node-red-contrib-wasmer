module.exports = function (RED) {
    function WasmerNode(config) {
        try {
            RED.nodes.createNode(this, config);
            const { UIMessageFactory, handleError, checkFetchURLFile } = require("./common");
            const UIMessage = UIMessageFactory(this, "WasmerNode");
            const node = this;
            this.allowlist = RED.nodes.getNode(config?.allowlist);
            const isAllowedURL = (str) => {
                if (str && this?.allowlist?.pttns?.length) {
                    const tests = this?.allowlist?.pttns.map(pttn => {
                        const res = new RegExp(pttn, this?.allowlist?.flags).test(str)
                        const tuple = [pttn, res];
                        return tuple;
                    });
                    console.log(str, "\n", tests);
                    if (this.allowlist?.mode == "and") {
                        return tests.every(([pttn, result]) => result);
                    } else {
                        return tests.some(([pttn, result]) => result);
                    }
                }
                return false;
            };
            /**************************************************
             * WASI bits
             * https://wasmerio.github.io/wasmer-js/
             **************************************************/
            const { init, WASI } = require('@wasmer/wasi');
            init().then(() => { }).catch(e => UIMessage(e, "red"));
            let instantiatedConfigStr = null;
            let wasmFileBuffer = null;

            async function runWASI(configObj) {
                const wasiObj = {
                    env: configObj?.env ? JSON.parse(configObj.env) : {},
                    args: [configObj?.functionName ?? "main", ...configObj?.args ?? []]
                };
                const url = configObj?.url;
                if (url) {
                    if (!isAllowedURL(url)) {
                        throw new Error("URL not allowed");
                    }

                    if (!wasmFileBuffer || JSON.stringify(configObj) != instantiatedConfigStr) {
                        wasmFileBuffer = await checkFetchURLFile(node, configObj?.url, {}, "wasmer");
                        instantiatedConfigStr = JSON.stringify(configObj);
                    }

                    if (!wasmFileBuffer) {
                        throw new Error("No buffer, couldn't retrieve file");
                    }
                    const wasi = new WASI(wasiObj);
                    const module = await WebAssembly.compile(new Uint8Array(wasmFileBuffer));
                    await wasi.instantiate(module, {});

                    //https://github.com/wasmerio/wasmer-js/blob/main/examples/node/fs.mjs
                    function createDirFile(path, content) {
                        // path = path.startsWith("/") ? path : `/${path}`;
                        if (content) {
                            let file = wasi.fs.open(path, { read: true, write: true, create: true });
                            switch (typeof content) {
                                case "undefined": break;
                                case "object":
                                    if (Array.isArray(content) && typeof content[0] === "number") {
                                        file.write(content);
                                    } else {
                                        file.writeString(JSON.stringify(content));
                                    }
                                    break;
                                default:
                                    file.writeString("" + content);
                                    break;
                            }
                            file.seek(0);
                        }
                    }
                    function readDirFile(path) {
                        return wasi.fs.open(path, { read: true }).readString();
                    }

                    if (configObj?.dirs) {
                        Object.entries(configObj.dirs).forEach(([path, content]) => {
                            createDirFile(path, content);
                        });
                    }

                    if (configObj?.stdin) {
                        wasi.setStdinString(`${configObj.stdin}`);
                    }

                    let exitCode = wasi.start();
                    let stdout = wasi.getStdoutString();
                    let stderr = wasi.getStderrString();
                    let dirs = configObj?.dirs ?? {};

                    if (configObj?.dirs) {
                        Object.keys(configObj.dirs).forEach(path => {
                            dirs[path] = readDirFile(path);
                        });
                    }

                    return { exitCode, stdout, stderr, dirs };
                }
            }

            /**************************************************
             * Input handling
             **************************************************/
            this.on("input", async function (msg, send, done) {
                console.log("wasmer.onInput", msg);
                try {
                    let usingConfig = msg?.wasmer ? { ...config, ...msg.wasmer } : config;
                    UIMessage("running function...");
                    const result = await runWASI(usingConfig);
                    const exitCode = result?.exitCode ?? 0;
                    msg.wasmer = msg?.wasmer ? { ...msg?.wasmer, ...result } : result;
                    UIMessage(exitCode, exitCode ? "red" : "green", exitCode ? false : true);
                    send(msg);
                    if (done) {
                        done();
                    }
                } catch (err) {
                    handleError(node, err, msg, done);
                }
            });
            this.on('close', function (removed, done) {
                if (removed) {
                    // This node has been disabled/deleted
                } else {
                    // This node is being restarted
                }
                if (done) {
                    done();
                }
            });
        } catch (err) {
            console.log("\n!!! Couldn't construct WasmerNode: " + err?.message ?? JSON.stringify(err) + "\n");
        }
    }
    RED.nodes.registerType("wasmer", WasmerNode);
}