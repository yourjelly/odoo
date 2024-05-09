import { _t } from "@web/core/l10n/translation";
import { TicketScreen } from "@point_of_sale/app/screens/ticket_screen/ticket_screen";
import { useAutofocus } from "@web/core/utils/hooks";
import { patch } from "@web/core/utils/patch";
import { Component, useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

patch(TicketScreen.prototype, {
    setup() {
        super.setup();
        this.notification = useService("notification");
    },

     //@override
    _getSearchFields() {
        return Object.assign({}, super._getSearchFields(...arguments), {
            BRAND: {
                repr: (order) => order.get_brand_name(),
                displayName: _t("Brand"),
                modelField: "brand_id",
            },
        });
    },

    async _acceptOrder(order) {
        await this.pos.data.call("pos.order", "accept_delivery_order", [order.id]);
        try {
            await this.pos.sendOrderInPreparationUpdateLastChange(order);
        } catch {
            this.notification.add(
                _t("Error while sending in preparation display."),
                {
                    type: "danger",
                },
            );
        }
        // this.pos.showScreen("ReceiptScreen")
        // this.ui.acceptDeliveryOrderLoading = true;
        // await this.pos.data.call("pos.order", "accept_delivery_order", [order.id]);
        // this.ui.acceptDeliveryOrderLoading = false;
        // console.log("order.delivery_status=====",order.delivery_status);
        // order.delivery_status = order.delivery_status == "awaiting"
        //     ? "scheduled"
        //     : "confirmed";
        // try {
        //     await this.pos.sendOrderInPreparationUpdateLastChange(this.state.selectedOrder);
        // } catch {
            // this.pos.notification.add(
            //     _t("Error to send in preparation display."),
            //     {
            //         type: "warning",
            //     },
            // );
        // }
        // const orderStates = this._getOrderStates();
        // orderStates.set("SYNCED", { text: _t("Paid") });
        // this.pos.showScreen("ReceiptScreen")
    },

    // async _rejectOrder(order) {
    //     // await this.pos.data.call("pos.order", "reject_delivery_order", [order_id]);
    //     // const confirmed = await ask(this.dialog, {
    //     //     title: _t("Reject order"),
    //     //     body: _t("Are you sure you want to reject this order?"),
    //     //     confirmLabel: _t("Confirm"),
    //     //     cancelLabel: _t("Discard"),
    //     // });
    //     // if (!confirmed) {
    //     //     return false;
    //     // }
    //     // this.ui.acceptDeliveryOrderLoading = true;
    //     // await this.pos.data.call("pos.order", "reject_delivery_order", [order.id, "busy"]);
    //     // this.ui.acceptDeliveryOrderLoading = false;
    //     // order.delivery_status = "cancelled";
    //     // return true;
    // },
})
