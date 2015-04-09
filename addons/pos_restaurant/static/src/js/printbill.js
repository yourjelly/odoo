function openerp_restaurant_printbill(instance,module){
    var QWeb = instance.web.qweb;
	var _t = instance.web._t;

    module.PosWidget.include({
        print_bill: function() {
            var order = this.pos.get('selectedOrder');
            if (order.get('orderLines').models.length > 0) {
                var receipt = order.export_for_printing({
                    'nopayment': true,
                });

                this.pos.proxy.print_receipt(QWeb.render('XmlReceipt',{
                    receipt: receipt, widget: this,
                }));
            }
        },
        build_widgets: function(){
            var self = this;
            this._super();

            if(this.pos.config.iface_printbill){
                var printbill = $(QWeb.render('PrintBillButton'));

                printbill.click(function(){
                    self.print_bill();
                });

                printbill.appendTo(this.$('.control-buttons'));
                this.$('.control-buttons').removeClass('oe_hidden');
            }
        },
    });
}
