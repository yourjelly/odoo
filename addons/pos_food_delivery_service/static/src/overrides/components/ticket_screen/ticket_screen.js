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
    },

    getDeliveryStatus(order) {
        const statusCombination = {
            awaiting: "Awaiting",
            scheduled: "Scheduled",
            confirmed: "Confirmed",
            preparing: "Preparing",
            ready: "Ready",
            delivered: "Delivered",
            cancelled: "Cancelled",
        };
        debugger;
        if (
            !order.delivery_asap &&
            order.delivery_status &&
            !["cancelled", "delivered"].includes(order.delivery_status)
        ) {
            const dateTimeObject = new Date(order.delivery_prepare_for);
            const hours = dateTimeObject.getHours().toString().padStart(2, "0");
            const minutes = dateTimeObject.getMinutes().toString().padStart(2, "0");
            const prepareFor = `(for ${hours}:${minutes})`;
            return order.delivery_status
                ? statusCombination[order.delivery_status].concat(" ", prepareFor)
                : "";
        }
        return order.delivery_status ? statusCombination[order.delivery_status] : "";
    },

    // async onFilterSelected(selectedFilter) {
    //     super.onFilterSelected(...arguments);
    //     debugger;
    //     if (this.state.filter == "DELIVERY") {
    //         await this._fetchDeliveryOrders();
    //     }
    // },

    // _computeDeliveryOrdersDomain() {
    //     const { fieldName, searchTerm } = this._state.ui.searchDetails;
    //     if (!searchTerm) {
    //         return [
    //             ["delivery_id", "!=", ""],
    //             ["amount_total", ">=", 0],
    //         ];
    //     }
    //     const modelField = this._getSearchFields()[fieldName].modelField;
    //     if (modelField) {
    //         return [
    //             [modelField, "ilike", `%${searchTerm}%`],
    //             ["delivery_id", "!=", ""],
    //             ["amount_total", ">=", 0],
    //         ];
    //     } else {
    //         return [];
    //     }
    // },

    // async _fetchDeliveryOrders() {
    //     const domain = this._computeDeliveryOrdersDomain();
    //     await this._fetchPaidOrders(domain);
    //     this._state.syncedOrders.toShow.sort((a, b) => {
    //         const delivery_status_value = {
    //             awaiting: 1,
    //             scheduled: 2,
    //             confirmed: 3,
    //             preparing: 4,
    //             ready: 5,
    //             delivered: 6,
    //             cancelled: 7,
    //         };
    //         return (
    //             delivery_status_value[a.delivery_status] - delivery_status_value[b.delivery_status]
    //         );
    //     });
    //     for (const order of this._state.syncedOrders.toShow) {
    //         switch (order.delivery_status) {
    //             case "awaiting":
    //                 order.bgClass = "bg-warning";
    //                 break;
    //             case "scheduled" || "confirmed":
    //                 order.bgClass = "bg-secondary";
    //                 break;
    //             case "preparing":
    //                 order.bgClass = "bg-success";
    //                 break;
    //             case "ready":
    //                 order.bgClass = "bg-info";
    //                 break;
    //             default:
    //                 order.bgClass = "";
    //                 break;
    //         }
    //     }
    // },

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
        order.delivery_status = order.delivery_asap
            ? "preparing"
            : order.delivery_status == "awaiting"
            ? "scheduled"
            : "confirmed";
        // await this.pos.data.call("pos.order", "accept_delivery_order", [order.id]);
        // try {
        //     await this.pos.sendOrderInPreparationUpdateLastChange(order);
        // } catch {
        //     this.notification.add(
        //         _t("Error while sending in preparation display."),
        //         {
        //             type: "danger",
        //         },
        //     );
        // }
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
