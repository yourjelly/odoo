odoo.define('point_of_sale.SyncNotification', function(require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const Registries = require('point_of_sale.Registries');

    class SyncNotification extends PosComponent {
        static props = {
            sync: { type: Object, shape: { status: String, pending: Number } },
        }
        onClick() {
            this.env.pos.push_orders(null, { show_error: true });
        }
    }
    SyncNotification.template = 'SyncNotification';

    Registries.Component.add(SyncNotification);

    return SyncNotification;
});
