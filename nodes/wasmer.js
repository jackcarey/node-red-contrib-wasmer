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
             * https://github.com/jackcarey/wasmer-js/blob/main/tests/index.spec.js
             **************************************************/
            const { init, WASI } = require('@wasmer/wasi');
            init().then(() => { }).catch(e => UIMessage(e, "red"));
            let instantiatedConfigStr = null;
            let wasmFileBuffer = null;

            async function runWASI(configObj) {
                console.log("running wasi...");
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
                    const externalFns = configObj?.externalFns ? JSON.parse(configObj?.externalFns) : {};
                    const instanceOpts = Object.keys(externalFns)?.length ? {
                        'module': externalFns
                    } : {};
                    console.log("instanceOpts", instanceOpts);
                    // const instance = await wasi.instantiate(module, instanceOpts);
                    await wasi.instantiate(module,{});

                    //https://github.com/wasmerio/wasmer-js/blob/main/examples/node/fs.mjs
                    function createDirFile(path, content) {
                        console.log("createFileDir...", path, content);
                        if (content?.length) {
                            let file = wasi.fs.open(path, { read: true, write: true, create: true });
                            switch (typeof content) {
                                case "undefined": break;
                                case "string":
                                    file.writeString(content);
                                    break;
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
                        } else {
                            wasi.fs.createDir(path);
                        }
                    }
                    function readDirFile(path) {
                        const meta = wasi.fs.metadata(path);
                        if (meta?.filetype) {
                            const { file } = meta.filetype;
                            if (file) return wasi.fs.open(path, { read: true }).readString();
                            return wasi.fs.readDir(path);
                        }
                    }

                    let dirs = configObj?.dirs ? JSON.parse(configObj.dirs) : {};

                    const dirArray = config?.dirs ? Object.keys(dirs) : [];
                    if (dirArray?.length) {
                        dirArray.forEach(path => {
                            createDirFile(path, dirs[path] ?? null);
                        });
                    }

                    if (configObj?.stdin?.length) {
                        wasi.setStdinString(`${configObj.stdin}`);
                    }

                    // let exitCode = wasi.start(instance);
                    let exitCode = wasi.start();
                    let stdout = wasi.getStdoutString();
                    let stderr = wasi.getStderrString();

                    if (dirArray?.length) {
                        Object.keys(dirs).forEach(path => { 
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