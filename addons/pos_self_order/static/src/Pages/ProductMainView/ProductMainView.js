/** @odoo-module */

import { Component, onWillUnmount, useState } from "@odoo/owl";
import { useSelfOrder } from "@pos_self_order/SelfOrderService";
import { NavBar } from "@pos_self_order/Components/NavBar/NavBar";
import { Line } from "../../models/line";
import { Product } from "../../models/product";

export class ProductMainView extends Component {
    static template = "pos_self_order.ProductMainView";
    static props = { product: Product };
    static components = {
        NavBar,
    };

    setup() {
        this.selfOrder = useSelfOrder();
        this.product = this.props.product;
        this.selfOrder.lastEditedProductId = this.product.id;
        this.state = useState({
            qty: 1,
            customer_note: "",
            selectedVariants: [],
            cartQty: 0,
        });

        onWillUnmount(() => {
            this.selfOrder.editedLine = null;
        });

        this.initState();
    }

    initState() {
        const editedLine = this.selfOrder.editedLine;
        if (editedLine) {
            this.state.customer_note = editedLine.customer_note;
            this.state.cartQty = editedLine.qty - 1;

            if (editedLine.selectedVariants) {
                this.state.selectedVariants = editedLine.selectedVariants;
            }
        } else {
            // select default variant
            this.state.selectedVariants = this.product.attributes.reduce((acc, curr) => {
                acc[curr.name] = curr.values[0].name;
                return acc;
            }, []);
        }
        return 0;
    }

    get fullProductName() {
        const productAttributeString = Object.values(this.state.selectedVariants).join(", ");
        let name = `${this.product.name}`;

        if (productAttributeString) {
            name += ` (${productAttributeString})`;
        }

        return name;
    }

    get backRoute() {
        return this.env.getPreviousRoute() === "cart" ? "/cart" : "/products";
    }

    changeQuantity(increase) {
        return increase ? this.state.qty++ : this.state.qty--;
    }

    addToCart() {
        const lines = this.selfOrder.currentOrder.lines;
        const lineIdx = lines.findIndex(
            (l) =>
                (l.full_product_name === this.fullProductName ||
                    this.selfOrder.editedLine?.uuid === l.uuid) &&
                (l.customer_note === "" || this.selfOrder.editedLine?.uuid === l.uuid) &&
                l.product_id === this.product.id
        );

        const line = new Line({
            qty: this.state.cartQty + this.state.qty,
            product_id: this.product.id,
            full_product_name: this.fullProductName,
            customer_note: this.state.customer_note,
            selectedVariants: this.state.selectedVariants,
        });

        if (lineIdx >= 0) {
            lines[lineIdx] = line;
        } else {
            lines.push(line);
        }

        this.selfOrder.currentOrder.lines = lines.filter((o) => o.qty > 0);
        this.selfOrder.getOrderTaxesFromServer();
        this.env.navigate(this.backRoute);
    }
}
