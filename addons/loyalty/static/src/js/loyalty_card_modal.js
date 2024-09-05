import { Component } from '@odoo/owl';
import { Dialog } from '@web/core/dialog/dialog';
import publicWidget from '@web/legacy/js/public/public_widget';
import { rpc } from '@web/core/network/rpc';

publicWidget.registry.PortalLoyaltyWidget = publicWidget.Widget.extend({
    selector: '.o_loyalty_card',
    events: {
        'click .o_loyalty_button_click': '_onPortalLoyalty',
    },
    showHistory: true,
    showRewards: false,
    async _loadData(ev){
        const card_id = ev.currentTarget.dataset.card;
        let result = await rpc("/get/loyalty_card/values", {"card_id": card_id});
        return {
            ...result,
            'showRewards': this.showRewards,
            'showHistory': this.showHistory,
        };
    },

    async _onPortalLoyalty(ev) {
        const data = await this._loadData(ev)
        this.call("dialog", "add", PortalLoyalty, data);
    },
});

export class PortalLoyalty extends Component {
    static components = { Dialog };
    static template = 'loyalty.modal_loyalty_card';

    static props = ["*"];

    setup() {
        this.csrf_token = odoo.csrf_token;
    }
}
