odoo.define('point_of_sale.NotificationSound', function (require) {
    'use strict';

    const { useState } = owl;
    const PosComponent = require('point_of_sale.PosComponent');

    class NotificationSound extends PosComponent {
        constructor() {
            super(...arguments);
            this.state = useState({ src: false });
        }
        playSound(name) {
            let src = false;
            if (name === 'error') {
                src = '/point_of_sale/static/src/sounds/error.wav';
            } else if (name === 'bell') {
                src = '/point_of_sale/static/src/sounds/bell.wav';
            }
            this.state.src = src;
        }
    }
    NotificationSound.template = 'NotificationSound';

    return NotificationSound;
});
