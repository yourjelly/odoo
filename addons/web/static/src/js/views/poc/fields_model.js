odoo.define("poc.fields_model", function (require) {
    "use strict";

    const Model = require("web/static/src/js/model.js");
    const Registry = require("web.Registry");

    class FieldsModelExtension extends Model.Extension {
    }

    class FieldsModel extends Model {
    }

    FieldsModel.Extension = FieldsModelExtension;
    FieldsModel.registry = new Registry(null,
        (value) => value.prototype instanceof FieldsModel.Extension
    );

    return FieldsModel;
});
