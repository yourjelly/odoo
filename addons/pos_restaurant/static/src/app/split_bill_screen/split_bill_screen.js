import { registry } from "@web/core/registry";
import { usePos } from "@point_of_sale/app/store/pos_hook";
import { Component, useState } from "@odoo/owl";
import { Orderline } from "@point_of_sale/app/generic_components/orderline/orderline";
import { OrderWidget } from "@point_of_sale/app/generic_components/order_widget/order_widget";

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

    createSplittedOrder() {
        const curOrderUuid = this.currentOrder.uuid;
        const originalOrder = this.pos.models["pos.order"].find((o) => o.uuid === curOrderUuid);
        this.pos.selectedTable = null;
        const newOrder = this.pos.add_new_order();
        newOrder.note = `${newOrder.tracking_number} Split from ${originalOrder.table_id.table_number}`;
        newOrder.uiState.splittedOrderUuid = curOrderUuid;
        newOrder.originalSplittedOrder = originalOrder;

        // Create lines for the new order
        const lineToDel = [];
        for (const line of originalOrder.lines) {
            if (this.qtyTracker[line.uuid]) {
                this.pos.models["pos.order.line"].create(
                    {
                        ...line.serialize(),
                        qty: this.qtyTracker[line.uuid],
                        order_id: newOrder.id,
                    },
                    false,
                    true
                );

                if (line.get_quantity() === this.qtyTracker[line.uuid]) {
                    lineToDel.push(line);
                } else {
                    line.update({ qty: line.get_quantity() - this.qtyTracker[line.uuid] });
                }
            }
        }

        for (const line of lineToDel) {
            line.delete();
        }

        const changes = this.matchCurrentOrderStatus(originalOrder, newOrder);
        newOrder.last_order_preparation_change = changes[1];
        // there can be some line whuch are not splitted so can't be updated in the loop
        for (const orderduuid of Object.keys(originalOrder.last_order_preparation_change)) {
            if (changes[0][orderduuid]) {
                originalOrder.last_order_preparation_change[orderduuid].quantity =
                    changes[0][orderduuid].quantity;
            }
        }
        this.syncOrdersinKichen(originalOrder);
        // this.pos.sendOrderInPreparation(originalOrder);
        originalOrder.customerCount -= 1;
        originalOrder.set_screen_data({ name: "ProductScreen" });
        this.pos.selectedOrderUuid = null;
        this.pos.set_order(newOrder);
        this.back();
    }

    matchCurrentOrderStatus(originalOrder, newOrder) {
        //                                                 qtyBuffer                   unordered
        // total  ordered   splitted   neworiginal  neworiginal - alreadyordered   splitted + calculated    splitted > pending
        //  4         2         3             1                 -1                         2                       3 > 2 (set 2 of splitted to order)
        //  4         1         2             2                  1                         3                       2 > 3 don't add any qty to last_order... and pending qty reflect in original
        //  3         1         1             2                  1                         2                          similar to 2nd case
        const newupdatedchanges = {};
        const oldupdatedchanges = {};
        for (const lineuuid of newOrder.lines.map((item) => item.uuid)) {
            if (
                Object.keys(originalOrder.last_order_preparation_change).includes(lineuuid + " - ")
            ) {
                const orderDetail = originalOrder.last_order_preparation_change[lineuuid + " - "];
                const filteredLine = originalOrder.lines.filter((line) => line.uuid == lineuuid);
                const qtyBuffer = filteredLine[0]?.qty || 0 - orderDetail.quantity;
                if (filteredLine.length > 0) {
                    // set old one as it is just change quantity as per need
                    oldupdatedchanges[lineuuid + " - "] = orderDetail;
                }
                if (qtyBuffer < 0) {
                    // some order rest tobe ordered in new one
                    newupdatedchanges[lineuuid + " - "] = orderDetail;
                    newupdatedchanges[lineuuid + " - "].quantity = -1 * qtyBuffer; //set how many ordered
                    // all in original are ordered
                    if (filteredLine.length > 0) {
                        oldupdatedchanges[lineuuid + " - "].quantity = filteredLine[0]?.qty;
                    }
                } else if (qtyBuffer > 0) {
                    // some in original order which are unordered
                    const orderedqty = filteredLine[0].qty - qtyBuffer;
                    if (orderedqty > 0) {
                        oldupdatedchanges[lineuuid + " - "].quantity = orderedqty; //set how many ordered
                    }
                    orderDetail.qty = filteredLine[0]?.qty - qtyBuffer; // set how much ordered
                }
                // In rest cases no qty ordered in new order & all ordered in original one.
            }
        }
        return [oldupdatedchanges, newupdatedchanges];
    }

    async syncOrdersinKichen(originalOrder) {
        debugger
        // this.originalToUpdate = await this.pos.data.call(
        //     "pos_preparation_display.order",
        //     "get_preparation_display_order",
        //     [[], originalOrder.id],
        //     {}
        // );
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
