# node-red-wasmer

Use WebAssembly files in [NodeRED](https://nodered.org/) via [wasmer-js](https://github.com/wasmerio/wasmer-js).

## Prerequisites

Node.js v16+

## How to install

Follow the instructions on the NodeRED website, or run `npm i @jackcarey/node-red-wasmer` in your server directory.

- [Adding Nodes to the paleltte - NodeRED](https://nodered.org/docs/user-guide/runtime/adding-nodes)

## How to use

### Inputs
1. Allowlist
   : allowlist (regex) : An allowed list of URL regular expression patterns.
2. URL
   : url (string) : The address to fetch the WebAssembly file from.
3. Function
   : functionName (string) : The name of the function to run.
4. Standard Input
   : stdin (string) : Text to pass to the function after it first executes.
5. Environment Variables
   : env (JSON) : Environment variables that can be accessed withing the function.
6. Arguments
   : args (array[string]) : Arguments to pass into the function separated by spaces.
7. Directories
   : dirs (JSON) : Virtual file paths made available to the module, and their contents.
8. Age
   : maxHours (number) : The maximum number of hours before attempting to re-fetch the `.wasm` file.
   
**Overriding Inputs:** The following inputs can be overridden by passing them in `msg.payload`: `url`, `functionName`, `stdin`, `args`, `dirs`.
### Outputs
Available inside `msg.wasmer`.
1. Exit Code
   : exitCode (number) : The exit code of the function that ran.
2. Standard Input
   : stdin (string) : The input buffer as a string.
3. Standard Output
   : stdout (string) : The console output of the function that ran.
4. StdErr
   : stderr (string) : Any error messages.
5. Directories
   : dirs (JSON) : The path and contents of each virtual file.

### Example Flow:

Check out the example flow:

```
[{"id":"133003c439760d95","type":"tab","label":"nodered-wasmer Example","disabled":false,"info":"","env":[]},{"id":"934b7209325e2a48","type":"inject","z":"133003c439760d95","name":"","props":[{"p":"payload"},{"p":"topic","vt":"str"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"","payloadType":"date","x":100,"y":40,"wires":[["c45792a03579023d"]]},{"id":"c45792a03579023d","type":"wasmer","z":"133003c439760d95","name":"","allowlist":"cb20093a9c91192e","url":"https://wasmer-js.pages.dev/demo.wasm","maxHours":72,"functionName":"demo","env":"{}","dirs":"{}","args":[],"x":250,"y":40,"wires":[["e900503182390afb"]]},{"id":"4f75ac69e9295bcb","type":"inject","z":"133003c439760d95","name":"","props":[{"p":"payload"},{"p":"topic","vt":"str"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"","payloadType":"date","x":100,"y":80,"wires":[["85169c18711cd456"]]},{"id":"85169c18711cd456","type":"wasmer","z":"133003c439760d95","name":"","allowlist":"cb20093a9c91192e","url":"https://wasmer-js.pages.dev/envvar.wasm","maxHours":72,"functionName":"envvar","env":"{\"ENV1\":\"one\",\"ENV2\":\"TWO\",\"DOG\":\"WOOF\",\"DOG_TYPE\":\"LABRADOR\"}","dirs":"{}","args":[],"x":250,"y":80,"wires":[["e900503182390afb"]]},{"id":"234baa9942ee8613","type":"inject","z":"133003c439760d95","name":"","props":[{"p":"payload"},{"p":"topic","vt":"str"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"","payloadType":"date","x":100,"y":160,"wires":[["572654faad6376db"]]},{"id":"572654faad6376db","type":"wasmer","z":"133003c439760d95","name":"","allowlist":"cb20093a9c91192e","url":"https://wasmer-js.pages.dev/mapdir.wasm","maxHours":72,"functionName":"mapdir","stdin":"","env":"{}","dirs":"{\"/a\":\"\",\"/b\":\"\",\"/file\":\"fileContents\"}","args":[],"x":250,"y":160,"wires":[["0b5801ca54f5c0d6"]]},{"id":"13caaf3e2449291d","type":"inject","z":"133003c439760d95","name":"","props":[{"p":"payload"},{"p":"topic","vt":"str"}],"repeat":"","crontab":"","once":false,"onceDelay":0.1,"topic":"","payload":"","payloadType":"date","x":100,"y":120,"wires":[["c3863094134224a6"]]},{"id":"c3863094134224a6","type":"wasmer","z":"133003c439760d95","name":"","allowlist":"cb20093a9c91192e","url":"https://wasmer-js.pages.dev/pipe_reverse.wasm","maxHours":72,"functionName":"pipe_reverse","stdin":"Hello world!","env":"{}","dirs":"{}","args":[],"x":270,"y":120,"wires":[["e900503182390afb"]]},{"id":"e900503182390afb","type":"debug","z":"133003c439760d95","name":"stdout","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"wasmer.stdout","targetType":"msg","statusVal":"","statusType":"auto","x":430,"y":80,"wires":[]},{"id":"0b5801ca54f5c0d6","type":"debug","z":"133003c439760d95","name":"wasmer","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"wasmer","targetType":"msg","statusVal":"","statusType":"auto","x":440,"y":160,"wires":[]},{"id":"cb20093a9c91192e","type":"urlAllowlist","name":"wasmer-js","mode":"and","flags":"gmi","pttns":"^https:\\/\\/wasmer-js.pages.dev\\/"}]
```
