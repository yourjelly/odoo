import { registry } from "@web/core/registry";
import { usePos } from "@point_of_sale/app/hooks/pos_hook";
import { Component, useState } from "@odoo/owl";
import { Orderline } from "@point_of_sale/app/components/orderline/orderline";
import { OrderWidget } from "@point_of_sale/app/components/order_widget/order_widget";

export class SplitBillScreen extends Component {
    static template = "pos_restaurant.SplitBillScreen";
    static components = { Orderline, OrderWidget };
    static props = {
        disallow: { type: Boolean, optional: true },
    };

    setup() {
        this.pos = usePos();
        this.qtyTracker = useState({});
        this.priceTracker = useState({});
    }

    get currentOrder() {
        return this.pos.get_order();
    }

    get orderlines() {
        return this.currentOrder.get_orderlines();
    }

    get newOrderPrice() {
        return Object.values(this.priceTracker).reduce((a, b) => a + b, 0);
    }

    get qtyTrackerLength() {
        return Object.values(this.qtyTracker).filter((l) => l > 0).length;
    }

    onClickLine(line) {
        const lines = line.getAllLinesInCombo();

        for (const line of lines) {
            if (!line.is_pos_groupable()) {
                if (this.qtyTracker[line.uuid] === line.get_quantity()) {
                    this.qtyTracker[line.uuid] = 0;
                } else {
                    this.qtyTracker[line.uuid] = line.get_quantity();
                }
            } else if (!this.qtyTracker[line.uuid]) {
                this.qtyTracker[line.uuid] = 1;
            } else if (this.qtyTracker[line.uuid] === line.get_quantity()) {
                this.qtyTracker[line.uuid] = 0;
            } else {
                this.qtyTracker[line.uuid] += 1;
            }

            this.priceTracker[line.uuid] =
                (line.get_price_with_tax() / line.qty) * this.qtyTracker[line.uuid];
        }
    }

    _getOrderName(order) {
        return order.table_id?.table_number.toString() || order.floatingOrderName || "";
    }

    _getLatestOrderNameStartingWith(name) {
        return (
            this.pos
                .get_open_orders()
                .map((order) => this._getOrderName(order))
                .filter((orderName) => orderName.slice(0, -1) === name)
                .sort((a, b) => a.slice(-1).localeCompare(b.slice(-1)))
                .at(-1) || name
        );
    }

    _getSplitOrderName(originalOrderName) {
        const latestOrderName = this._getLatestOrderNameStartingWith(originalOrderName);
        if (latestOrderName === originalOrderName) {
            return `${originalOrderName}B`;
        }
        const lastChar = latestOrderName[latestOrderName.length - 1];
        if (lastChar === "Z") {
            throw new Error("You cannot split the order into more than 26 parts!");
        }
        const nextChar = String.fromCharCode(lastChar.charCodeAt(0) + 1);
        return `${latestOrderName.slice(0, -1)}${nextChar}`;
    }

    async createSplittedOrder() {
        const curOrderUuid = this.currentOrder.uuid;
        let originalOrder = this.pos.models["pos.order"].find((o) => o.uuid === curOrderUuid);
        const originalOrderName = this._getOrderName(originalOrder);
        const newOrderName = this._getSplitOrderName(originalOrderName);

        let newOrder = this.pos.createNewOrder();
        newOrder.floating_order_name = newOrderName;
        newOrder.uiState.splittedOrderUuid = curOrderUuid;
        newOrder.originalSplittedOrder = originalOrder;

        const splitQty = this._computeSplitQry(originalOrder, this.qtyTracker);
        // Create lines for the new order
        const lineToDel = [];
        for (const line of originalOrder.lines) {
            if (this.qtyTracker[line.uuid]) {
                const data = line.serialize();
                delete data.uuid;
                const newOrderLine = this.pos.models["pos.order.line"].create(
                    {
                        ...data,
                        qty: splitQty[line.uuid].newOrderline.qty,
                        order_id: newOrder.id,
                    },
                    false,
                    true
                );
                splitQty[line.uuid].newOrderline["uuid"] = newOrderLine.uuid;

                if (line.get_quantity() === this.qtyTracker[line.uuid]) {
                    lineToDel.push(line);
                }
                // Update line quantity and handle zero values after sending order in preparation
                line.update({ qty: splitQty[line.uuid].originalOrderline.qty });
                // Mark line as 'splitted' in the originalOrder's last_order_preparation_change
                if (line.preparationKey in originalOrder.last_order_preparation_change.lines) {
                    originalOrder.last_order_preparation_change.lines[line.preparationKey][
                        "splitted"
                    ] = true;
                }
            }
        }
        const deleteLines = () => {
            for (const line of lineToDel) {
                originalOrder.lines.find((ol) => ol.uuid === line.uuid)?.delete();
            }
        };

        // Update preparation display if originalOrder is included.
        // Add originalOrder UUID to newOrder and send both orders for update.
        if (
            this.pos.orderPreparationCategories.size &&
            Object.keys(originalOrder.last_order_preparation_change.lines).length > 0
        ) {
            this.env.services.ui.block();
            originalOrder.updateLastOrderChange();
            newOrder.updateLastOrderChange();
            newOrder.last_order_preparation_change["original_order_uuid"] = originalOrder.uuid;

            await this.pos.sendOrderInPreparationUpdateLastChange(originalOrder);
            originalOrder = this.pos.models["pos.order"].find((o) => o.uuid === originalOrder.uuid);
            deleteLines();
            await this.pos.sendOrderInPreparationUpdateLastChange(newOrder);

            this.env.services.ui.unblock();
        } else {
            deleteLines();
        }
        newOrder = this.pos.models["pos.order"].find((o) => o.uuid === newOrder.uuid);
        for (const [key, qtyValue] of Object.entries(splitQty)) {
            const ogOrderline = originalOrder.lines.find((l) => l.uuid === key);
            if (ogOrderline) {
                ogOrderline.qty += qtyValue.originalOrderline.remaining;
            }

            const newOrderline = newOrder.lines.find((l) => l.uuid === qtyValue.newOrderline.uuid);
            if (newOrderline) {
                newOrderline.qty += qtyValue.newOrderline.remaining;
            }
        }

        originalOrder.customer_count -= 1;
        originalOrder.set_screen_data({ name: "ProductScreen" });
        newOrder.set_screen_data({ name: "ProductScreen" });
        this.pos.selectedOrderUuid = null;
        this.pos.set_order(newOrder);
        this.back();
    }

    _computeSplitQry(originalOrder, qtyTracker) {
        const splitQty = {};
        for (const line of originalOrder.lines) {
            if (qtyTracker[line.uuid]) {
                const orderedQty =
                    originalOrder.last_order_preparation_change.lines[line.preparationKey]
                        ?.quantity || 0;
                const unorderedQty = line.qty - orderedQty;

                const delta = qtyTracker[line.uuid] - unorderedQty;
                const newQty = delta > 0 ? delta : 0;

                splitQty[line.uuid] = {
                    originalOrderline: {
                        qty: orderedQty - newQty,
                        remaining: unorderedQty - (qtyTracker[line.uuid] - newQty),
                    },
                    newOrderline: {
                        qty: newQty,
                        remaining: qtyTracker[line.uuid] - newQty,
                    },
                };
            }
        }
        return splitQty;
    }

    getLineData(line) {
        const splitQty = this.qtyTracker[line.uuid];

        if (!splitQty) {
            return line.getDisplayData();
        }

        return { ...line.getDisplayData(), qty: `${splitQty} / ${line.get_quantity_str()}` };
    }

    back() {
        this.pos.showScreen("ProductScreen");
    }
}

registry.category("pos_screens").add("SplitBillScreen", SplitBillScreen);
