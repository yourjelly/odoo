/** @odoo-module **/

import { registerModel } from '@mail/model/model_core';
import { attr, one } from '@mail/model/model_field';
import { clear } from '@mail/model/model_field_command';

registerModel({
    name: 'KanbanFieldActivityView',
    lifecycleHooks: {
        _created() {
            this.messaging.messagingBus.addEventListener("reload-activity-button", this._onUpdateButton);
        },
        _willDelete() {
            this.messaging.messagingBus.removeEventListener("reload-activity-button", this._onUpdateButton);
        },
    },
    recordMethods:{
        _onUpdateButton(ev){
            if (this.webRecord.resId == ev.detail.resId){
                this.update({ activityButtonView: this.activityButtonView ? clear() : {} });
            }
        },
    },
    fields: {
        activityButtonView: one('ActivityButtonView', {
            default: {},
            inverse: 'kanbanFieldActivityViewOwner',
            required: true,
        }),
        id: attr({
            identifying: true,
        }),
        thread: one('Thread', {
            required: true,
        }),
        webRecord: attr({
            required: true,
        }),
    },
});
