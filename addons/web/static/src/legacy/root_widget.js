odoo.define("root.widget", function (require) {
    require("web.legacySetup");
    const { standaloneAdapter } = require("web.OwlCompatibility");
    const { Component } = owl;
    return standaloneAdapter({ Component }); // for its method _trigger_up
});
