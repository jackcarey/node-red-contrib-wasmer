var http = require('http');
var express = require("express");
var RED = require("node-red");
var hooks

// Create an Express app
var app = express();

// Add a simple route for static content served from 'public'
app.use("/", express.static("public"));

// Create a server
var server = http.createServer(app);

const monitoredNodeTypes = ["urlAllowlist", "wasmer"];
require("./hooks.js").registerHooks(RED, monitoredNodeTypes || []);

// Create the settings object - see default settings.js file for other options
var settings = {
    httpAdminRoot: "/red",
    httpNodeRoot: "/api",
    httpStaticRoot: '/public/',
    userDir: "./.nodered/",
    flowFile: 'flows.json',
    flowFilePretty: true,
    functionGlobalContext: {},    // enables global context
    contextStorage: {
        default: {
            module: "memory"
        }
    },
    //ref: https://nodered.org/docs/user-guide/runtime/logging
    logging: {
        console: {
            level: "debug",
            metrics: false,
            audit: false
        }
    },
    editorTheme: {
        tours: false,
        codeEditor: {
            lib: "monaco", //can be "monaco" or "ace"
        },
        palette: {
            //WebAssembly has been inserted at the top of the list so that it is easier to access the nodes used in this project
            categories: ['WebAssembly', 'subflows', 'common', 'function', 'network', 'sequence', 'parser', 'storage'],
        }
    }
};

// Initialise the runtime with a server and settings
RED.init(server, settings);

// Serve the editor UI from /red
app.use(settings.httpAdminRoot, RED.httpAdmin);

// Serve the http nodes UI from /api
app.use(settings.httpNodeRoot, RED.httpNode);

server.listen(8000);

// Start the runtime
RED.start();