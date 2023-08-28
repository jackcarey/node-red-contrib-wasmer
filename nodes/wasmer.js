module.exports = function (RED) {
    function WasmerNode(config) {
        try {
            RED.nodes.createNode(this, config);
            const { UIMessageFactory, handleError, checkFetchURLFile } = require("./common");
            const UIMessage = UIMessageFactory(this, "WasmerNode");
            /**************************************************
             * WASI bits
             **************************************************/
            const { init, WASI } = require('@wasmer/wasi');
            init().then(() => { }).catch(e => UIMessage(e, "red", true, "WASI-init"));
            const node = this;
            this.allowlist = RED.nodes.getNode(config?.allowlist);
            const isAllowedURL = (str) => {
                if (str && this?.allowlist?.pttns?.length) {
                    const tests = this?.allowlist?.pttns.map(pttn => {
                        const res = new RegExp(pttn, this?.allowlist?.flags).test(str)
                        const tuple = [pttn, res];
                        return tuple;
                    });
                    if (this?.allowlist?.mode == "and") {
                        return tests.every(([pttn, result]) => result ? true : false) ?? false;
                    } else {
                        return tests.some(([pttn, result]) => result ? true : false) ?? false;
                    }
                }
                return false;
            };

            let instantiatedConfigStr = null;
            let wasmFileBuffer = null;

            async function runWASI(configObj) {
                const wasiObj = {
                    env: {},
                    args: [configObj?.functionName ?? "main", ...configObj?.args ?? []],
                };
                const url = configObj?.url;
                if (url) {
                    if (!isAllowedURL(url)) {
                        UIMessage("URL not allowed", "red");
                    }

                    if (!wasmFileBuffer || JSON.stringify(configObj) != instantiatedConfigStr) {
                        wasmFileBuffer = await checkFetchURLFile(node, configObj?.url, {}, "wasmer");
                        instantiatedConfigStr = JSON.stringify(configObj);
                    }

                    if (!wasmFileBuffer) {
                        UIMessage("No buffer, couldn't retrieve file", "red");
                    }
                    const wasi = new WASI(wasiObj);
                    const module = await WebAssembly.compile(new Uint8Array(wasmFileBuffer));
                    await wasi.instantiate(module, {});
                    let exitCode = wasi.start()
                    let stdout = wasi.getStdoutString();
                    let stderr = wasi.getStderrString();
                    return { exitCode, stdout, stderr };
                }
            }

            /**************************************************
             * Input handling
             **************************************************/
            this.on("input", async function (msg, send, done) {
                console.log("wasmer.onInput", msg);
                try {
                    let usingConfig = msg?.wasmer ? { ...config, ...msg.wasmer } : config;
                    UIMessage(node, "running function...");
                    const result = await runWASI(usingConfig);
                    const exitCode = result?.exitCode ?? 0;
                    msg.wasmer = msg?.wasmer ? { ...msg?.wasmer, ...result } : result;
                    if (done) {
                        UIMessage(node, exitCode, exitCode ? "red" : "green", exitCode ? false : true);
                        done();
                    }
                    send(msg);
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