/** @odoo-module **/

import { NewContentModal, MODULE_STATUS } from '@website/systray_items/new_content';
import { patch } from 'web.utils';

patch(NewContentModal.prototype, 'website_livechat_new_content', {
    setup() {
        this._super();

        const newChannelElement = this.state.newContentElements.find(element => element.moduleXmlId === 'base.module_website_livechat');
        newChannelElement.createNewContent = () => this.createNewChannel();
        newChannelElement.status = MODULE_STATUS.INSTALLED;
    },

    createNewChannel() {}
});
