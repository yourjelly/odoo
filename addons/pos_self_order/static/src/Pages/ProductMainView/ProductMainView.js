/** @odoo-module */

import { Component, useState } from "@odoo/owl";
import { useSelfOrder } from "@pos_self_order/SelfOrderService";
import { NavBar } from "@pos_self_order/Components/NavBar/NavBar";
import { Line } from "../../models/line";
export class ProductMainView extends Component {
    static template = "pos_self_order.ProductMainView";
    static props = { product: Object };
    static components = {
        NavBar,
    };

    setup() {
        this.selfOrder = useSelfOrder();
        this.editedLine = true;
        this.selfOrder.lastEditedProductId = this.props.product.id;
        this.state = useState({
            line: null,
        });

        this.initLine();
    }

    initLine() {
        // FIXME: we need to verify the product name for future attribute variants
        let line = this.selfOrder.currentOrder.lines.find(
            (o) => o.product_id === this.props.product.id
        );

        if (!line) {
            this.editedLine = false;
            line = new Line(
                {
                    qty: 1,
                    product_id: this.props.product.id,
                },
                this
            );
        }

        this.state.line = line;
    }

    changeQuantity(increase) {
        return increase ? this.state.line.qty++ : this.state.line.qty--;
    }

    /**
     * @param {Object} selectedVariants
     * @param {import ("@pos_self_order/SelfOrderService").Attribute[]} attributes
     * @param {"list_price" | "price_with_tax" | "price_without_tax"} type
     * @returns {Number}
     */
    getPriceExtra(selectedVariants, attributes, type = "list_price") {
        return (
            Object.entries(selectedVariants).reduce((sum, selected) => {
                return (
                    sum +
                    attributes
                        .find((attribute) => attribute.name == selected[0])
                        .values.find((value) => value.name == selected[1]).price_extra[type]
                );
            }, 0) || 0
        );
    }
    getAllPricesExtra(selectedVariants, attributes) {
        const getPriceExtra = (type) => this.getPriceExtra(selectedVariants, attributes, type);
        const priceTypes = ["list_price", "price_without_tax", "price_with_tax"];
        return Object.fromEntries(priceTypes.map((type) => [type, getPriceExtra(type)]));
    }

    addToCart() {
        const line = this.state.line;
        const product = this.props.product;
        const lines = this.selfOrder.currentOrder.lines;
        const lineIdx = lines.findIndex((o) => o.uuid === line.uuid);

        line.description = Object.values(line.selectedVariants).join(", ");
        line.price_extra = this.getAllPricesExtra(line.selectedVariants, product.attributes);

        if (lineIdx >= 0) {
            lines[lineIdx] = this.state.line;
        } else {
            lines.push(this.state.line);
        }

        // If a command line does not have a quantity greater than 0, we consider it deleted
        this.selfOrder.getOrderTaxesFromServer();
        this.selfOrder.currentOrder.lines = lines.filter((o) => o.qty > 0);
        this.env.navigate(this.returnRoute());
    }

    returnRoute() {
        return this.env.getPreviousRoute() === "cart" ? "/cart" : "/products";
    }
}
