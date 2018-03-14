odoo.define('crm_template_import.import', function (require) {
"use strict";

var core = require('web.core');
var BaseImport = require('base_import.import');

var _t = core._t;

BaseImport.DataImport.include({
    renderImportLink: function() {
        this._super();
        if (this.res_model == 'crm.lead') {
            this.$(".import-link").prop({"text": _t(" Import Template for Leads & Opportunities"), "href": "/crm/static/xls/crm.template.xlsx"});
            this.$(".template-import").removeClass("hidden");
        }
    },
});

});
