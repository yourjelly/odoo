odoo.define('point_of_sale.SyncNotification', function (require) {
    'use strict';

    const { useState } = owl;
    const PosComponent = require('point_of_sale.PosComponent');

    /**
     * @emits 'click-sync-notification'
     */
    class SyncNotification extends PosComponent {
        constructor() {
            super(...arguments);
            this.state = useState({ status: 'connected' });
        }
        /**
         * @param {'connected' | 'connecting' | 'disconnected' | 'error'} status
         */
        setSyncStatus(status) {
            this.state.status = status;
        }
    }
    SyncNotification.template = 'SyncNotification';

    return SyncNotification;
});
