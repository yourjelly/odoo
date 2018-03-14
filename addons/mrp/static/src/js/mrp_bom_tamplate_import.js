odoo.define('mrp_bom_template_import.import', function (require) {
"use strict";

var core = require('web.core');
var BaseImport = require('base_import.import');

var _t = core._t;

BaseImport.DataImport.include({
    renderImportLink: function() {
        this._super();
        if (this.res_model == 'mrp.bom') {
            this.$(".import-link").prop({"text": _t(" Import Template for Bills of Materials"), "href": "/mrp/static/xls/mrp.bom.template.xlsx"});
            this.$(".template-import").removeClass("hidden");
        }
    },
});

});
