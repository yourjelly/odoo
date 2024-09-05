/** @odoo-module */
import { PortalLoyalty } from "@loyalty/js/loyalty_card_modal";
import { patch } from "@web/core/utils/patch";

patch(PortalLoyalty.prototype, {
    template : 'website_sale_loyalty.modal_loyalty_card_reward',
});
