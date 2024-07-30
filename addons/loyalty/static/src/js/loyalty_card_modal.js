/** @odoo-module **/

import { Component } from "@odoo/owl";
import { Dialog } from '@web/core/dialog/dialog';
import publicWidget from "@web/legacy/js/public/public_widget";
import { rpc } from "@web/core/network/rpc";

publicWidget.registry.PortalLoyaltyWidget = publicWidget.Widget.extend({
    selector: ".o_modal_test_selector",
    events: {
        "click .o_modal_test_event_click": "_onPortalLoyalty",
    },
    showHistory: true,
    showRewards: false,
    async _loadData(ev){
        let card_id = ev.currentTarget.dataset.card
        let program = ev.currentTarget.dataset.program
        let result = await rpc("/my/loyaltyPortalValues", {"card_id": card_id});
        result['showRewards'] = this.showRewards;
        result['showHistory'] = this.showHistory;
        result['program_type'] = program
        result['img_path'] = program == "Loyalty Card"? '/loyalty/static/src/img/Award.svg' : '/loyalty/static/src/img/Wallet.svg';
        return result;
    },

    async _onPortalLoyalty(ev) {
        this.call("dialog", "add", PortalLoyalty, await this._loadData(ev));
    },
});

export class PortalLoyalty extends Component {
    static components = { Dialog};
    static template = 'loyalty.modal_loyalty_card';
    static props = {
        ...Component.props
    }
    setup(){
        this.csrf_token = odoo.csrf_token;
    }
}
