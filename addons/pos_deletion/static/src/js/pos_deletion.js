odoo.define('pos_deletion.deletion', function (require) {
    var core    = require('web.core');
    var screens = require('point_of_sale.screens');
    var models = require('point_of_sale.models');
    var devices = require('point_of_sale.devices');
    var chrome = require('point_of_sale.chrome');
    var gui = require('point_of_sale.gui');
    var DB = require('point_of_sale.DB');
    var popups = require('point_of_sale.popups');
    var Class = require('web.Class');
    var utils = require('web.utils');
    var PosBaseWidget = require('point_of_sale.BaseWidget');
    var SplitbillScreenWidget = require('pos_restaurant.splitbill').SplitbillScreenWidget;

    var _t      = core._t;
    var round_pr = utils.round_precision;
    var QWeb = core.qweb;

    var orderline_super = models.Orderline.prototype;
    models.Orderline = models.Orderline.extend({
        set_quantity: function (quantity, keep_price) {
            var current_quantity = this.get_quantity();
            var future_quantity = parseFloat(quantity) || 0;
            if (keep_price && (future_quantity === 0 || future_quantity < current_quantity)) {
                this.pos.gui.show_popup("number", {
                    'title': _((current_quantity > 0? "Decrease": "Increase") + " the quantity by"),
                    'confirm': function (qty_decrease) {
                        if (qty_decrease) {
                            var order = this.pos.get_order();
                            var selected_orderline = order.get_selected_orderline();
                            qty_decrease = qty_decrease.replace(_t.database.parameters.decimal_point, '.');
                            qty_decrease = parseFloat(qty_decrease, 10);

                            if(selected_orderline.product.uom_id[1] === "Units")
                                qty_decrease = parseInt(qty_decrease, 10);

                             var current_total_quantity_remaining = selected_orderline.get_quantity();
                            order.get_orderlines().forEach(function (orderline, index, array) {
                                if (selected_orderline.id != orderline.id &&
                                    selected_orderline.get_product().id === orderline.get_product().id &&
                                    selected_orderline.get_discount() === orderline.get_discount()) {
                                    current_total_quantity_remaining += orderline.get_quantity();
                                }
                            });

                            if (current_quantity > 0 && qty_decrease > current_total_quantity_remaining) {
                                this.pos.gui.show_popup("error", {
                                    'title': _t("Order error"),
                                    'body':  _t("Not allowed to take back more than was ordered."),
                                });
                            } else {
                                var decrease_line = order.get_selected_orderline().clone();
                                decrease_line.order = order;
                                decrease_line.set_quantity(current_quantity > 0? -qty_decrease: qty_decrease);
                                order.add_orderline(decrease_line);
                            }
                        }
                    }
                });
            } else {
                orderline_super.set_quantity.apply(this, arguments);
            }
        },
        can_be_merged_with: function(orderline) {
            var order = this.pos.get_order();
            var res = orderline_super.can_be_merged_with.apply(this, arguments);
            if (res && this.quantity < 0 || (this.quantity < 0 && orderline.quantity < 0)) {
                return false;
            }
            return res;
        },
    });

    SplitbillScreenWidget.include({
        set_line_on_order: function(neworder, split, line) {
            if( split.quantity ){
                if ( !split.line ){
                    split.line = line.clone();
                    neworder.add_orderline(split.line);
                }
                split.line.set_quantity(split.quantity);
            }else if( split.line ) {
                neworder.remove_orderline(split.line);
                split.line = null;
            }
        },

        set_quantity_on_order: function(splitlines, order) {
            for(var id in splitlines){
                var split = splitlines[id];
                var line  = order.get_orderline(parseInt(id));

                var decrease_line = line.clone();
                decrease_line.order = order;
                decrease_line.set_quantity(-split.quantity);
                order.add_orderline(decrease_line);

                delete splitlines[id];
            }
        },

        check_full_pay_order:function(order, splitlines) {
            // Because of the lines added with negative quantity when we remove product,
            // we have to check if the sum of the negative and positive lines are equals to the split.
            var full = true;
            order.get_orderlines().forEach(function(orderLine) {
                var split = splitlines[orderLine.id];
                if(orderLine.get_quantity() > 0) {
                    if(!split) {
                        full = false
                    } else {
                        if(split.quantity >= 0) {
                            var qty = 0;
                            var total_quantity = 0;
                            var lines = order.get_orderlines();
                            for(var i = 0; i < lines.length; i++){
                                if(lines[i].get_product().id === orderLine.get_product().id) {
                                    total_quantity += lines[i].get_quantity();
                                    qty += (splitlines[lines[i].id]? splitlines[lines[i].id].quantity : 0)
                                }
                            }

                            if(qty !== total_quantity)
                                full = false;
                        }
                    }
                }
            });
            return full;
        },

        lineselect: function($el,order,neworder,splitlines,line_id){
            var split = splitlines[line_id] || {'quantity': 0, line: null};
            var line  = order.get_orderline(line_id);

            this.split_quantity(split, line, order, splitlines);

            this.set_line_on_order(neworder, split, line);

            splitlines[line_id] = split;
            $el.replaceWith($(QWeb.render('SplitOrderline',{
                widget: this,
                line: line,
                selected: split.quantity !== 0,
                quantity: split.quantity,
                id: line_id,
            })));
            this.$('.order-info .subtotal').text(this.format_currency(neworder.get_subtotal()));
        },

        split_quantity: function(split, line, order, splitlines) {
            var total_quantity = 0;
            var splitted = 0;

            order.get_orderlines().forEach(function(orderLine) {
                if(orderLine.get_product().id === line.product.id){
                    total_quantity += orderLine.get_quantity();
                    splitted += splitlines[orderLine.id]? splitlines[orderLine.id].quantity: 0;
                }
            });

            if(line.get_quantity() > 0) {
                if( !line.get_unit().is_pos_groupable ){
                    if( split.quantity !== total_quantity){
                        split.quantity = total_quantity;
                    }else{
                        split.quantity = 0;
                    }
                }else{
                    if( splitted < total_quantity && split.quantity < line.get_quantity()){
                        split.quantity += line.get_unit().is_pos_groupable ? 1 : line.get_unit().rounding;
                        if(splitted > total_quantity){
                            split.quantity = line.get_quantity();
                        }
                    }else{
                        split.quantity = 0;
                    }
                }
            }
        },

        pay: function(order,neworder,splitlines){
            this._super(order,neworder,splitlines);
            order.set_screen_data('screen','products');
        }
    });

    screens.ProductScreenWidget.include({
        show: function(){
            this._super();
        },
        _onKeypadKeyDown: function (ev) {
            var order = this.pos.get_order();
            var orderline = this.pos.get_order().selected_orderline;
            var last_id = Object.keys(order.orderlines._byId)[Object.keys(order.orderlines._byId).length-1]

            if(last_id === orderline.cid && orderline.quantity > 0){
                this._super(event);
            }
        },
    });

    screens.NumpadWidget.include({
        clickAppendNewChar: function(event) {
            var order = this.pos.get_order();
            var orderline = this.pos.get_order().selected_orderline;
            var last_id = Object.keys(order.orderlines._byId)[Object.keys(order.orderlines._byId).length-1]

            if(last_id === orderline.cid && orderline.quantity > 0){
                this._super(event);
            }
        },
    });

    var NumberPopupWidget = popups.include({
        show: function(options){
           this._super(options);
           $(document).off('keydown.productscreen', this.gui.screen_instances.products._onKeypadKeyDown);
        },
        close: function(){
            $(document).on('keydown.productscreen', this.gui.screen_instances.products._onKeypadKeyDown);
        },
    });
 });
