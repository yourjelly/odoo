odoo.define('website_event.ticket_qty_selection', function (require) {
'use strict';

const publicWidget = require('web.public.widget');
const core = require('web.core');

publicWidget.registry.EventTicketQtySelection = publicWidget.Widget.extend({
    selector: '.o_event_ticket_qty_selection',
    events: {
        'change': '_onQtyChange',
    },

    start: function () {
        this.ticketId = this.$el.data('ticketId');
    },

    _onQtyChange: function (ev) {
        core.bus.trigger('event_ticket_qty_change', { ticketId: this.ticketId, qty: ev.target.value });
    },
});

return publicWidget.registry.EventTicketQtySelection;

});
