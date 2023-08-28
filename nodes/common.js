/*****************************
 * This file contains helper functions that are common to all or some of the nodes in this package
 *****************************/
const fs = require("fs");
const path = require('path');
const seedrandom = require('seedrandom');

/**
 * `UIMessage(node, text = "", color = "blue", isFilled = false)`
 * 
 * Handles node status and logging of a message. Set msg to an empty string to clear the status.
 * @param node - The node object
 * @param [msg] - The text to display in the status box.
 * @param [color] - The color of the status indicator. 'yellow' to warn, 'red' for errors, 'blue' for info, 'green' for OK, grey or null for anything else.
 * @param [isFilled=false] - If true, the status icon will be a ring. If false, it will be a dot.
 * @param [loc] - Optional location to help debug where this error is coming from
 */
function UIMessage(node, msg = "", color = null, isFilled = false, loc = "") {
    if (!msg) {
        node.status({});
        return;
    }
    //convert debugging levels to UI colors
    switch (color) {
        case "warn": color = "yellow"; break;
        case "error": color = "red"; break;
        case "ok": color = "green"; break;
        case "info": color = "blue"; break;
        case "log": color = ""; break;
        case "gray": color = "grey"; break;
        default: break;
    }


    let colors = {
        "yellow": "🟡", //warn
        "red": "🔴", //error
        "green": "🟢", //all good
        "blue": "🔵", //information
        "grey": "⚪", //other
    };
    if (color && Object.keys(colors).indexOf(color) == -1) {
        color = null;
    }
    let locStr = (loc ? `@${loc}: ` : "");
    let consoleText = locStr + (color ? `${colors[color]} ${msg}` : msg);
    //errors aren't actually thrown here as it's assumed they're intentionally suppressed when they become a UI message
    if (color == "red") {
        console.log(msg);
        node.error(msg);
    } else if (color == "yellow") {
        node.warn(msg + "")
    } else {
        node.debug(consoleText);
    }
    if (color) {
        node.status({
            fill: color + "",
            shape: (isFilled ? "dot" : "ring"),
            text: locStr + msg
        });
    } else {
        node.status({
            text: locStr + msg
        });
    }
}

function UIMessageFactory(node, UIMessageLocation = "") {
    return (msg = "", color = null, isFilled = false, loc = "") => { return UIMessage(node, msg, color, isFilled, loc ?? UIMessageLocation); };
}

function handleError(node, err, msg = {}, done = null) {
    const str = err?.message ?? JSON.stringify(err);
    UIMessage(node, str, "error", true);
    if (done) {
        // Node-RED 1.0 compatible
        done(err);
    } else {
        // Node-RED 0.x compatible
        node.error(err, msg);
    }
}

/**
 * If the date is older than the current date minus the maxAge, then it's too old.
 * @param dt - The date to check
 * @returns A function that takes a date and returns true if the date is older than the maxAge.
 */
const isTooOld = function (dt, maxHours) {
    if (!maxHours) {
        return false;
    }
    let oldest = new Date();
    oldest.setHours(oldest.getHours() - (parseInt(maxHours) || 0));
    return dt <= oldest;
}

/**
 * It converts a string or boolean to a boolean, avoiding lazy truthy values.
 * @param val - The value to convert to a boolean.
 * @returns boolean
 */
function toBool(val) {
    return val === "true" || val === true || val === 1;
}

/**
 * Sanitise a URL so all non-alphanumeric characters are removed and the result is truncated to 200 characters
 * 
 * @param url - The URL of the file you want to sanitise.
 * @param roughlen - The maximum amount of characters the URL will use within the file name.
 * @returns The sanitised string.
 */
function URLtoWASMFileName(url, roughLen = 50) {
    const rand = ("" + seedrandom(url)()).substring(2, 8); //6 random digits seeded from the URL
    const charReplace = (str) => str.replace(/[^A-z0-9\.\-]/gi, "");
    const endOfString = (str) => {
        const idx = str.length - roughLen;
        return str.substring(Math.max(0, idx));
    };
    try {
        const { host, pathname, hash, search } = new URL(url);
        let fname = endOfString(charReplace(host));
        //incrementally add elements of the URL to the file name until the length is hit.
        if (fname.length < roughLen) {
            fname += charReplace(pathname);
            fname = endOfString(fname);
        }
        if (fname.length < roughLen) {
            fname += charReplace(search);
            fname = endOfString(fname);
        }
        if (fname.length < roughLen) {
            fname += charReplace(hash);
            fname = endOfString(fname);
        }

        if (!fname.endsWith(".wasm")) {
            fname += ".wasm";
        }
        return `${rand}-${fname}`;
    } catch (e) {
        //if a URL object cannot be constructed, use the primitive string instead.
        const decoded = decodeURIComponent(url);
        let shortened = endOfString(charReplace(decoded));
        if (!shortened.endsWith(".wasm")) {
            shortened += ".wasm";
        }
        return `${rand}-${shortened}`;
    }
}

function JoinPaths(...paths) {
    return path.join(...paths);
}

/**
 * It returns the full path of the file. It creates the directory of the final path if it is not already available.
 * @param subpaths - An ordered list of fragments making up the sub/relative path to the file you want to read. This could be just a file name.
 * @returns The absolute full path to the file that is prefixed with the working directory.
 */
function FullPath(...subpaths) {
    let dir = path.dirname(__filename); //__filename used instead of __dirname as it refers to the location of the common.js file, not the calling server root folder
    let res = dir;
    if (subpaths.length) {
        res = path.join(dir, ...subpaths);
    }
    let res_dir = path.dirname(res);
    if (!fs.existsSync(res_dir)) {
        fs.mkdirSync(res_dir);
    }
    return res;
}

/**
 * If the file doesn't exist or is older than maxHours, download it from url and save it to the
 * specified location.
 * @param node - the node that is calling the function
 * @param url - the url to fetch
 * @param init - URL fetch init object
 * @param subFolderName - the name of the subfolder to create in the node-red user directory. If you
 * don't want to create a subfolder, pass in null.
 * @param [maxHours=72] - The maximum number of minutes that the file can be old before it's
 * considered stale.
 * @returns a buffer of file data.
 */
async function checkFetchURLFile(node, url, init, subFolderName, maxHours = 72) {
    const fname = URLtoWASMFileName(url);
    const fullPath = FullPath(subFolderName, fname);
    let stats = null;
    let modifiedAt = null;
    try {
        stats = fs.statSync(fullPath);
        modifiedAt = stats?.mtimeMs ? new Date(stats.mtimeMs) : null;
    } catch (e) {
        //do nothing, file doesn't exist or couldn't be read, which will be handled below
        // UIMessage(node, "Couldn't access file stats", "warn", false, "checkFetchURLFile");
    }
    if (!stats || !modifiedAt || isTooOld(modifiedAt, maxHours)) {
        try {
            UIMessage(node, "Downloading file", "info", false, "checkFetchURLFile");
            const validateResp = (resp) => {
                const code = resp.status;
                if (!resp.ok) {
                    console.log("response not OK: ", resp.statusText)
                    UIMessage(node, url, "debug", false, "checkFetchURLFile");
                    throw new Error(`Response was not OK: ${code} ${resp.statusText}`);
                }
                const mimeType = resp.headers.get("Content-Type");
                if (mimeType != "application/wasm") {
                    UIMessage(node, url, "debug", false, "checkFetchURLFile");
                    console.log("WebAssembly not returned", mimeType);
                    throw new Error(`WebAssembly not returned: ${mimeType}`);
                }
                return resp.arrayBuffer();
            };
            return fetch(url, init).then(resp => validateResp(resp)).then(arrayBuffer => {
                UIMessage(node, `Saving arrayBuffer to ${fullPath}...`, "info");
                const buff = Buffer.from(arrayBuffer);
                fs.writeFileSync(fullPath, buff, { flag: "w+" });
                UIMessage(node, "File saved", "info", false, "fetchedArrayBuffer");
                return buff;
            }).catch(err => {
                UIMessage(node, err, "error", true, "fetchedArrayBuffer");
                throw new Error(err);
            });
        } catch (e) {
            UIMessage(node, e, "warn", "checkFetchURLFile");
        }
    } else {
        const data = fs.readFileSync(fullPath, { flag: "r" });
        return Buffer.from(data);
    }
    return null;
}

module.exports = { UIMessage, UIMessageFactory, handleError, checkFetchURLFile, };