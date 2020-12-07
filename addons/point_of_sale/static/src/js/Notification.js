odoo.define('point_of_sale.Notification', function (require) {
    'use strict';

    const { useState } = owl;
    const PosComponent = require('point_of_sale.PosComponent');

    class Notification extends PosComponent {
        constructor() {
            super(...arguments);
            this.state = useState({ show: false, message: '' });
        }
        onClickToastNotification() {
            this.state.show = false;
            this.state.message = '';
        }
        showNotification(message, duration) {
            this.state.show = true;
            this.state.message = message;
            setTimeout(() => {
                this.state.show = false;
                this.state.message = '';
            }, duration || 1000);
        }
    }
    Notification.template = 'Notification';

    return Notification;
});
