/** @odoo-module **/

import Widget from '@web/legacy/js/core/widget';

export const PublicLivechatFloatingTextView = Widget.extend({
    template: 'im_livechat.legacy.PublicLivechatFloatingTextView',
    init(parent, messaging) {
        this._super(parent);
        this.messaging = messaging;
        this.publicLivechatFloatingTextView = this.messaging.publicLivechatGlobal.livechatButtonView.floatingTextView;
    },
});
