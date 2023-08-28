'use strict';

/**
 * Return a function that will record an event for NodeRED hooks, but only if the node type is within the restricted types list
 */
function EventHandlerFactory(restrictTypes, eventType, getNodeFn) {
    return (event) => {
        const node = getNodeFn(event);
        const nodeType = node?.type;
        if (nodeType && restrictTypes?.length > 0 && restrictTypes.indexOf(nodeType) == -1) {
            return;
        }
        console.log(eventType, node, msg);
    }
}

/**
 * Return a function that will handle an array of 'SendEvent' objects for NodeRED hooks, but only if the node type is within the restricted types list
 */
function SendEventArrayHandler(restrictTypes, RED) {
    return (array) => {
        // let handler = SendEventHandler(restrictTypes);
        let handler = EventHandlerFactory(restrictTypes, "send", (evt) => setIDOnNode(RED, evt?.source?.node));
        for (let event of array) {
            handler(event);
        }
    };
}

function registerHooks(RED, monitoredNodeTypes) {
    //generic catch-all hooks for debugging
    const addGenericHook = (hookName) => {
        RED.hooks.add(hookName, (evt) => {
            const nodeType = (evt?.destination?.node ?? evt?.node?.node)?.type ?? "";
            if (monitoredNodeTypes.indexOf(nodeType) != -1) {
                const sectionLine = () => console.log("=".repeat(40));
                sectionLine();
                console.log(hookName,
                    nodeType ?? "",
                    evt?.module ?? "",
                    evt?.msg ?? "");
            }
        });
    }
    const routerHooks = ["preRoute", "preDeliver", "postDeliver"];
    // routerHooks.forEach(h => addGenericHook(h));
    const sendHooks = ["onSend"];
    sendHooks.forEach(h => addGenericHook(h));
    const executionHooks = ["onReceive", "onComplete"]
    executionHooks.forEach(h => addGenericHook(h));
    const installHooks = ["preInstall", "postInstall", "preUninstall", "postUninstall"];
    installHooks.forEach(h => addGenericHook(h));

    //RED.hooks.add("onReceive", EventHandlerFactory(monitoredNodeTypes, "receive", (evt) => evt?.destination?.node));
    //RED.hooks.add("onComplete", EventHandlerFactory(monitoredNodeTypes, "complete", (evt) => evt?.node?.node));
}

module.exports = { SendEventArrayHandler, EventHandler: EventHandlerFactory, registerHooks };