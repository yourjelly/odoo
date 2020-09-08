odoo.define("poc.ViewModelExtension", function (require) {
    "use strict";

    const ActionModel = require("web/static/src/js/views/action_model.js");

    class ViewModelExtension extends ActionModel.Extension {
        static extractArchInfo(archs, viewType) {
            return archs[viewType];
        }
    }
    ViewModelExtension.layer = 2;

    return ViewModelExtension;
});
