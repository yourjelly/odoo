import { _t } from "@web/core/l10n/translation";
import { TicketScreen } from "@point_of_sale/app/screens/ticket_screen/ticket_screen";
import { useAutofocus } from "@web/core/utils/hooks";
import { patch } from "@web/core/utils/patch";
import { Component, useState } from "@odoo/owl";
import { SelectPartnerButton } from "@point_of_sale/app/screens/product_screen/control_buttons/select_partner_button/select_partner_button";
import { useService } from "@web/core/utils/hooks";
import { ask } from "@point_of_sale/app/store/make_awaitable_dialog";

patch(TicketScreen.prototype, {
    setup() {
        super.setup();
        this.state.acceptDeliveryOrderLoading = false;
        this.notification = useService("notification");
        debugger;
    },

    //@override
    _getSearchFields() {
        return Object.assign({}, super._getSearchFields(...arguments), {
            DELIVERY_PARTNER: {
                repr: (order) => order.get_brand_name(),
                displayName: _t("Deliver Partner"),
                modelField: "delivery_partner",
            },
        });
    },

    //@override
    _getFilterOptions() {
        const res = super._getFilterOptions();
        res.set("DELIVERY", { text: _t("Delivery") });
        return res;
    },

    async _acceptDeliveryOrder(order) {
        this.state.acceptDeliveryOrderLoading = true;
        await this.pos.data.call("pos.order", "accept_delivery_order", [order.id]);
        this.state.acceptDeliveryOrderLoading = false;
        order.delivery_status = order.delivery_status == "awaiting" ? "scheduled" : "confirmed";
        // await this.pos.sendOrderInPreparationUpdateLastChange(order);
    },

    async _setOrder(order) {
        if (this.pos.isOpenOrderShareable()) {
            await this.pos.syncAllOrders();
        }
        this.pos.set_order(order);
        this.closeTicketScreen();
    },

    async _rejectDeliveryOrder(order) {
        const confirmed = await ask(this.dialog, {
            title: _t("Reject order"),
            body: _t("Are you sure you want to reject this order?"),
            confirmLabel: _t("Confirm"),
            cancelLabel: _t("Discard"),
        });
        if (!confirmed) {
            return false;
        }
        this.ui.acceptDeliveryOrderLoading = true;
        await this.pos.data.call("pos.order", "reject_delivery_order", [order.id, "busy"]);
        this.ui.acceptDeliveryOrderLoading = false;
        order.delivery_status = "cancelled";
        return true;
    },
})
