(function() {
    "use strict";
    var _t = openerp._t;
    var QWeb = openerp.web.qweb;
    var warnings = {};
    openerp.sale_stock = function(instance) {
        instance.web.FormView.include({
            on_processed_onchange: function(result) {
                if (result && this.model == 'sale.order.line') {
                    if (result.warning) {
                        warnings[this.datarecord.id ? this.datarecord.product_id[1] : this.fields.product_id.current_display] = result.warning.message ? (this.fields.product_id.current_display + ' : ' + result.warning.message) : false;
                    }
                    $('.stock_alert').html(QWeb.render("sale_stock.warning", {
                        'warnings': _.compact(warnings)
                    }));
                } else {
                    this._super(result);
                }
            },
        });
    }
})();
