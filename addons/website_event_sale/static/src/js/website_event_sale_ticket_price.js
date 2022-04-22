odoo.define('website_event_sale.ticket_price', function (require) {
'use strict';

const publicWidget = require('web.public.widget');
const core = require('web.core');

publicWidget.registry.EventSaleTicketPrice = publicWidget.Widget.extend({
    selector: '.o_event_sale_ticket_price',
    events: {},

    start: function () {
        this.ticketId = this.$el.data('ticketId');
        core.bus.on('event_ticket_qty_change', this, this._qty_change);
    },

    _qty_change: function(data) {
        if (data.ticketId == this.ticketId) {
            this._rpc({
                model: 'event.ticket',
                method: 'read',
                args: [[this.ticketId]],
                context: { quantity:data.qty },
            }).then(function (ticket) {
                console.log('TICKET', ticket);
            });
        }
    },
});

return publicWidget.registry.EventSaleTicketPrice;

});
