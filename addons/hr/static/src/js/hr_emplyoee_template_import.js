odoo.define('hr_emplyoee_template_import.import', function (require) {
"use strict";

var core = require('web.core');
var BaseImport = require('base_import.import');

var _t = core._t;

BaseImport.DataImport.include({
    renderImportLink: function() {
        this._super();
        if (this.res_model == 'hr.employee') {
            this.$(".import-link").prop({"text": _t(" Import Template for Employees"), "href": "/hr/static/xls/hr.employee.template.xlsx"});
            this.$(".template-import").removeClass("hidden");
        }
    },
});

});
