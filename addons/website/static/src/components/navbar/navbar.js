/** @odoo-module **/

import { NavBar } from '@web/webclient/navbar/navbar';
import { useService, useBus } from '@web/core/utils/hooks';
import { registry } from "@web/core/registry";

import { patch } from 'web.utils';

const websiteSystrayRegistry = registry.category('website_systray');

patch(NavBar.prototype, 'website_navbar', {
    setup() {
        this._super();
        this.websiteService = useService('website');

        // The navbar is rerendered with an event, as it can not naturally be
        // with props/state (the WebsitePreview client action and the navbar
        // are not related).
        useBus(websiteSystrayRegistry, 'EDIT-WEBSITE', () => this.render(true));
    },

    /**
     * @override
     */
    get systrayItems() {
        if (this.websiteService.currentWebsite) {
            return websiteSystrayRegistry
                .getEntries()
                .map(([key, value]) => ({ key, ...value }))
                .filter((item) => ('isDisplayed' in item ? item.isDisplayed(this.env) : true))
                .reverse();
        }
        return this._super();
    },
});
