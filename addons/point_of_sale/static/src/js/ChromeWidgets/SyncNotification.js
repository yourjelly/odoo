odoo.define('point_of_sale.SyncNotification', function(require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const Registries = require('point_of_sale.Registries');

    const { onMounted, onWillUnmount, useState } = owl;

    // Previously SynchNotificationWidget
    class SyncNotification extends PosComponent {
        setup() {
            const synch = this.env.pos.get('synch');
            this.state = useState({ status: synch.status, msg: synch.pending });

            onMounted(() => {
                this.env.pos.on(
                    'change:synch',
                    (pos, synch) => {
                        this.state.status = synch.status;
                        this.state.msg = synch.pending;
                    },
                    this
                );
            });

            onWillUnmount(() => {
                this.env.pos.on('change:synch', null, this);
            });
        }
        onClick() {
            this.env.pos.push_orders(null, { show_error: true });
        }
    }
    SyncNotification.template = 'SyncNotification';

    Registries.Component.add(SyncNotification);

    return SyncNotification;
});
