/** @odoo-module */

import * as Order from "@point_of_sale/../tests/tours/utils/generic_components/order_widget_util";
import * as ProductScreen from "@point_of_sale/../tests/tours/utils/product_screen_util";

export function clickOrderButton() {
    return [
        {
            content: "click order button",
            trigger: ".actionpad .submit-order",
        },
    ];
}
export function isOrderlinesHaveNoChange() {
    return Order.doesNotHaveLine({ withClass: ".has-change" });
}
export function isOrderlineIsToOrder(name) {
    return Order.hasLine({
        productName: name,
        withClass: ".has-change.text-success.border-start.border-success.border-4",
    });
}
export function isOrderlineIsToSkip(name) {
    return Order.hasLine({
        withClass: ".skip-change.text-primary.border-start.border-primary.border-4",
        productName: name,
    });
}
export function isGuestNumberIs(num) {
    return [
        {
            content: `guest number is ${num}`,
            trigger: ProductScreen.controlButtonTrigger("Guests") + `:contains(${num})`,
            run: function () {}, // it's a check
        },
    ];
}
export function isOrderBtnPresent() {
    return [
        {
            content: "Order button is here",
            trigger: ".actionpad .button.submit-order",
            run: function () {}, // it's a check
        },
    ];
}
