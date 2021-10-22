/** @odoo-module **/

import { registerNewModel } from '@mail/model/model_core';
import { attr, one2one } from '@mail/model/model_field';

export const rtcLayoutMenu = {
    modelName: 'mail.rtc_layout_menu',
    identifyingFields: ['callViewer'],
    lifecycle: {
        _created() {
            this.onClickFilter = this.onClickFilter.bind(this);
            this.onClickLayout = this.onClickLayout.bind(this);
        },
    },
    recordMethods: {
        /**
         * @param {MouseEvent} ev
         */
        onClickFilter(ev) {
            ev.preventDefault();
            switch (ev.target.value) {
                case 'all':
                    this.callViewer.update({
                        filterVideoGrid: false,
                    });
                    break;
                case 'video':
                    this.callViewer.update({
                        filterVideoGrid: true,
                    });
                    break;
            }
        },
        /**
         * @param {MouseEvent} ev
         */
        onClickLayout(ev) {
            ev.preventDefault();
            this.messaging.userSetting.update({
                rtcLayout: ev.target.value,
            });
            this.component.trigger('dialog-closed');
        },
    },
    fields: {
        component: attr(),
        callViewer: one2one('mail.rtc_call_viewer', {
            inverse: 'rtcLayoutMenu',
            readonly: true,
        }),
    },
};

registerNewModel(rtcLayoutMenu);
