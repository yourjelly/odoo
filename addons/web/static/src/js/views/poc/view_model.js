odoo.define("poc.ViewModelExtension", function (require) {
    "use strict";

    const ActionModel = require("web/static/src/js/views/action_model.js");

    class ViewModelExtension extends ActionModel.Extension {
        constructor() {
            super(...arguments);
        }

        get() {
            console.log(this.config.get("domain"));

            return super.get(...arguments);
        }

        importState() {
            return super.importState(...arguments);
        }
        async load(params) {
            return super.load(...arguments);
        }
        prepareState() {
            return super.prepareState(...arguments);
        }

        static extractArchInfo(archs, viewType) {
            return archs[viewType];
        }
    }
    ViewModelExtension.layer = 2;

    // TODO: create and register a ViewModel by view types
    // ActionModel.registry.add("View", ViewModelExtension, 10);
    ActionModel.registry.add("pivot", ViewModelExtension, 10);

    return ViewModelExtension;
});
