odoo.define('product_template_import.import', function (require) {
"use strict";

var core = require('web.core');
var BaseImport = require('base_import.import');

var _t = core._t;

BaseImport.DataImport.include({
    renderImportLink: function() {
        this._super();
        if (this.res_model == 'product.template') {
            var self = this;
            this._rpc({
                model: 'ir.ui.menu',
                method: 'name_get',
                args: [[parseInt($.bbq.getState('menu_id'))]],
            }).then(function (module) {
                if (module[0][1] === 'Purchases') {
                    self.$(".import-link").prop({"text": _t(" Import Template for Products"), "href": "/product/static/xls/Products_with_vendors.xlsx"});
                } else {
                    self._rpc({
                        model: 'product.product',
                        method: 'get_pricelist_values',
                        args: [],
                    }).then(function (result) {
                        if (result === 'fixed' || result === 'formula') {
                            self.$(".import-link").prop({"text": _t(" Import Template for Products"), "href": "/product/static/xls/Products.xlsx"});
                        } else if (result === 'percentage') {
                            self.$(".import-link").prop({"text": _t(" Import Template for Products"), "href": "/product/static/xls/Products_with_several_prices.xlsx"});
                        }
                    });
                }
            });
            this.$(".template-import").removeClass("hidden");
        }
        if (this.res_model == 'product.supplierinfo') {
            this.$(".import-link").prop({"text": _t(" Import Template for Vendor Pricelists"), "href": "/product/static/xls/product.vendor.pricelist.template.xlsx"});
            this.$(".template-import").removeClass("hidden");
        }
        if (this.res_model == 'product.pricelist') {
            this.$(".import-link").prop({"text": _t(" Import Template for Pricelists"), "href": "/product/static/xls/product.pricelist.template.xlsx"});
            this.$(".template-import").removeClass("hidden");
        }
    },
});

});
