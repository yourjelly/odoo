/** @odoo-module **/

import { registerPatch } from '@mail/model';

registerPatch({
    name: 'NotificationGroupView',
    fields: {
        imageSrc: {
            compute() {
                if (this.notificationGroup.notification_type === 'snail') {
                    return '/snailmail/static/img/snailmail_failure.png';
                }
                return this._super();
            },
        },
    },
});
