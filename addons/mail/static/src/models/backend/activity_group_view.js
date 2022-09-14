/** @odoo-module **/

import { registerPatch } from '@mail/model/model_core';
import { one } from '@mail/model/model_field';
// ensure that the model definition is loaded before the patch
import '@mail/models/activity_group_view';

registerPatch({
    name: 'ActivityGroupView',
    fields: {
        activityMenuViewOwner: one('ActivityMenuView', {
            identifying: true,
            inverse: 'activityGroupViews',
        }),
    },
});
