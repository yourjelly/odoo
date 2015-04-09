openerp.pos_slip = function(instance){
    var module = instance.point_of_sale;
	var _t     = instance.web._t;
    var QWeb   = instance.web.qweb;

    module.Order = module.Order.extend({

        orderline_height: function(line) {
            var height = 1;
            if (line.discount) {
                height += 1;
            }
            if (line.unit_name !== 'Unit(s)') {
                height += 1;
            }
            return height;
        },

        endblock_height: function(receipt) {
            var endHeight = 0;   // The number of lines of the block after the orderlines

            endHeight += 4; // Height of TOTAL

            if (!receipt.nopayment) {
                endHeight += receipt.paymentlines.length;
                endHeight += 3; // Height of CHANGE
            }

            if (receipt.total_discount) {
                endHeight += 1; // Height of Discount Total
            }

            if (Math.abs(receipt.subtotal - receipt.total_with_tax) >= 0.000001) {
                endHeight += 3; // Height of SUBTOTAL 
            }

            endHeight += receipt.tax_details.length;

            return endHeight;
        },

        // exports the order as multiple JSONs to be used to print
        // several slips.
        //  - opts.lines: the number of printable lines per slips (default 100)
        //  - opts.withpayment: true if payment info should be included 
        export_for_slip_printing: function(opts) {
                opts      = opts || {};
            var receipt   = this.export_for_printing(opts);
            var lineHeight = 0;

            for (var i = 0; i < receipt.orderlines.length; i++) {
                lineHeight += this.orderline_height(receipt.orderlines[i]);
            }

            var slipHeight = opts.lines || 100;
            var endHeight  = this.endblock_height(receipt);
            var slipCount  = Math.ceil( (lineHeight + endHeight) / slipHeight);
            var slips = [];
            var linesLeft = receipt.orderlines.slice(0);

            for (var j = 0; j < slipCount; j++) {
                var slip = JSON.parse(JSON.stringify(receipt));
                    slip.page  = j+1;
                    slip.pages = slipCount;
                    slip.nopayment   = (j < slipCount - 1) || slip.nopayment;
                    slip.nototal     = (j < slipCount - 1);
                    slip.noinfo      = (j < slipCount - 1);
                    slip.orderlines  = [];

                var height = 0;
                while (linesLeft.length) {
                    var line = linesLeft.shift();
                    if (height + this.orderline_height(line) > slipHeight) {
                        linesLeft.unshift(line);
                        break;
                    } else {
                        height += this.orderline_height(line);
                        slip.orderlines.push(line);
                    }
                }

                if (j < slipCount - 1) {
                    slip.emptylines = slipHeight - height;
                } else {
                    slip.emptylines = slipHeight - height - endHeight; 
                }

                slips.push(slip);
            }

            return slips;
        },
    });

    var SlipPrintMixin = {
        print_slip: function(opts) {
            var self = this;
                opts = opts || {};
                opts.lines = this.pos.config.receipt_slip_lines;
                opts.width = this.pos.config.receipt_slip_width;
                opts.sheet = opts.sheet || 'slip';

            var order = this.pos.get('selectedOrder');
            var slips = order.export_for_slip_printing(opts);
            var done  = new $.Deferred();
            var ss    = this.screen_selector || this.pos_widget.screen_selector;

            function slip_popup(slips) { 
                if (!slips.length) {
                    done.resolve();
                } else {
                    var slip = slips.shift();
                    ss.show_popup('confirm',{
                        'message':_t('Print Page ')+slip.page+_t(' of ')+slip.pages,
                        'comment':_t('Please make sure there is paper in the tray before printing'),
                        'confirm': function() {

                            var xml = QWeb.render('XmlReceipt',{
                                receipt: slip, widget: self,
                            });

                            self.pos.proxy.print_receipt(xml);

                            setTimeout(function(){
                                slip_popup(slips);
                            },1000);
                        },
                        'cancel': function() {
                            done.reject();
                        },
                    });
                }
            }

            slip_popup(slips);
            return done;
        },
    };

    module.PaymentScreenWidget.include(SlipPrintMixin);

    module.PaymentScreenWidget.include({
        print_xml_receipt: function() {
            var self = this;
            if (this.pos.config.receipt_slip) {
                this.print_slip().then(function() {
                    self.pos.get('selectedOrder').destroy();
                });
            } else {
                this._super();
            }
        },
    });

    module.PosWidget.include(SlipPrintMixin);

    module.PosWidget.include({
        print_bill: function() { 
            if (this.pos.config.receipt_slip) {
                this.print_slip({nopayment:true});
            } else {
                this._super();
            }
        },
    });

};

