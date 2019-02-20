odoo.define('lunch_payment.LunchKanbanController', function (require) {
"use strict";

var LunchKanbanController = require('lunch.LunchKanbanController');

LunchKanbanController.include({
    custom_events: _.extend({}, LunchKanbanController.prototype.custom_events, {
        add_money: '_onAddMoney',
    }),

    _onAddMoney: function(ev) {
        ev.stopPropagation();
        this._showPaymentDialog();
    },
    _showPaymentDialog: function () {
        var self = this;

        var ctx = this.userId ? {default_user_id: this.userId} : {};

        var options = {
            on_close: function () {
                self.reload();
            },
        };

        this.do_action({
            res_model: 'lunch.payment.wizard',
            type: 'ir.actions.act_window',
            views: [[false, 'form']],
            target: 'new',
            context: ctx,
            // context: _.extend(ctx, {default_product_id: ev.data.productId, line_id: ev.data.lineId || false}),
        }, options);
    },
});

});
