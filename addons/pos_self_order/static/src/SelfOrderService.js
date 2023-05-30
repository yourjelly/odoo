/** @odoo-module */
import { useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { session } from "@web/session";
import { formatMonetary } from "@web/views/fields/formatters";
import { _t } from "@web/core/l10n/translation";
import { groupBy } from "@web/core/utils/arrays";
import { effect } from "@point_of_sale/utils";
import { Order } from "./models/order";
import { Product } from "./models/product";
import { Line } from "./models/line";

export class SelfOrder {
    constructor(...args) {
        this.setup(...args);
    }
    setup(env, rpc, notification) {
        Object.assign(this, {
            ...session.pos_self_order_data,
        });

        this.env = env;
        this.rpc = rpc;
        this.orders = [];
        this.tagList = new Set();
        this.editedOrder = null;
        this.productByIds = {};
        this.priceLoading = false;
        this.currentProduct = 0;
        this.lastEditedProductId = null;
        this.productsGroupedByTag = {};
        this.notification = notification;
        this.initData();

        effect((state) => this.saveOrderToLocalStorage(state.orders), [this]);

        if (!this.has_active_session) {
            this.closeNotification = this.notification.add(
                _t("The restaurant is closed. You can browse the menu, but ordering is disabled."),
                { type: "warning" }
            );
        }
    }

    initData() {
        const orders = JSON.parse(localStorage.getItem("orders")) ?? [];
        this.orders.push(...orders.map((o) => new Order(o)));

        this.products = this.products.map((p) => {
            const product = new Product(p);
            this.tagList.add(product.tag);
            this.productByIds[product.id] = product;
            return product;
        });

        this.productsGroupedByTag = groupBy(this.products, "tag");
    }

    saveOrderToLocalStorage(orders) {
        Array.isArray(orders) && localStorage.setItem("orders", JSON.stringify(orders));
    }

    // In case of self_order_pay_after === "meal", we keep the same order until the user pays
    // In case of self_order_pay_after === "each", we create a new order each time the user orders somethings
    get currentOrder() {
        if (this.editedOrder) {
            return this.editedOrder;
        }

        let existingOrder;
        const newOrder = new Order({
            pos_config_id: this.pos_config_id,
            access_token: this?.table?.access_token,
        });

        if (this.self_order_pay_after === "each") {
            // return an order who's not yet sent to the server
            existingOrder = this.orders.find((order) => !order.access_token);
        } else {
            // return an order who's in draft or a new order
            existingOrder = this.orders.find((order) => order.state === "draft");
        }

        if (!existingOrder) {
            this.orders.push(newOrder);
            this.editedOrder = newOrder;
        } else {
            this.editedOrder = existingOrder;
        }

        return this.editedOrder;
    }

    formatMonetary(price) {
        return formatMonetary(price, { currencyId: this.currency_id });
    }

    async sendDraftOrderToServer() {
        try {
            let order = {};

            if (this.currentOrder.isAlreadySent) {
                order = await this.rpc(`/pos-self-order/update-existing-order`, {
                    order: this.currentOrder,
                });
            } else {
                order = await this.rpc(`/pos-self-order/process-new-order`, {
                    order: this.currentOrder,
                });
            }

            this.editedOrder = Object.assign(this.editedOrder, order);
            this.editedOrder.lines = this.editedOrder.lines.map((line) => new Line(line));
            this.editedOrder.computelastChangesSent();

            if (this.self_order_pay_after === "each") {
                this.editedOrder = null;
            }

            this.notification.add(_t("Your order has been placed!"), { type: "success" });
        } catch {
            this.notification.add(_t("Error sending order"), { type: "danger" });
        } finally {
            this.navigate("/");
        }
    }

    async getOrderFromServer() {
        const posReferences = this.orders.map((order) => order.pos_reference);
        const accessTokens = this.orders.map((order) => order.access_token);

        try {
            const orderChanges = {};
            const orders = await this.rpc(`/pos-self-order/get-orders/`, {
                pos_references: posReferences,
                access_tokens: accessTokens,
            });

            // replace all the orders that have an access_token with the orders from the server
            this.orders = this.orders.filter((order) => {
                orderChanges[order.access_token] = order.lastChangesSent;
                return !order.access_token;
            });
            this.orders.push(
                ...orders.map((o) => {
                    const newOrder = new Order(o);
                    newOrder.lastChangesSent = orderChanges[newOrder.access_token];
                    return newOrder;
                })
            );
            this.editedOrder = null;
        } catch (e) {
            if (e.code !== 404) {
                this.notification.add(_t("Error when retrieving orders"), {
                    type: "danger",
                });
            }
        }
    }

    async getOrderTaxesFromServer() {
        this.priceLoading = true;
        try {
            const taxes = await this.rpc(`/pos-self-order/get-orders-taxes/`, {
                order: this.editedOrder,
                pos_config_id: this.pos_config_id,
            });

            for (const line of this.editedOrder.lines) {
                const lineTaxes = taxes.lines.find((ol) => ol.uuid === line.uuid);
                line.price_subtotal = lineTaxes.price_subtotal;
                line.price_subtotal_incl = lineTaxes.price_subtotal_incl;
            }

            this.editedOrder.amount_total = taxes.amount_total;
            this.editedOrder.amount_tax = taxes.amount_tax;
        } catch (e) {
            console.error(e);
            this.notification.add(_t("An error has occurred when calculating the price"), {
                type: "danger",
            });
        }
        this.priceLoading = false;
    }
}

export const selfOrderService = {
    dependencies: ["rpc", "notification"],
    async start(env, { rpc, notification }) {
        return new SelfOrder(env, rpc, notification);
    },
};
registry.category("services").add("self_order", selfOrderService);

export function useSelfOrder() {
    return useState(useService("self_order"));
}
