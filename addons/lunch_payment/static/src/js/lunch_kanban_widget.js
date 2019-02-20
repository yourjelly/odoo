odoo.define('lunch_payment.LunchKanbanWidget', function (require) {
"use strict";

var LunchKanbanWidget = require('lunch.LunchKanbanWidget');

LunchKanbanWidget.include({
    events: _.extend({}, LunchKanbanWidget.prototype.events, {
        'click .o_add_money': '_onAddMoney',
    }),

    _onAddMoney: function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        this.trigger_up('add_money', {});
    },
});

});
