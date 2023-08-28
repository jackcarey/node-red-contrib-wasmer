module.exports = function (RED) {
    function URLAllowListNode(n) {
        RED.nodes.createNode(this, n);
        this.name = n.name;
        this.mode = n?.mode ?? "or";
        this.flags = n?.flags ?? "gmi";
        this.pttns = n?.pttns?.split(new RegExp(`[\n\r]`, "gmi"))?.filter(x => x?.trim()?.length) ?? [];
    }
    RED.nodes.registerType("urlAllowlist", URLAllowListNode);
}