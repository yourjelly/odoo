/** @odoo-module **/

import { registry } from "@web/core/registry";
import { PosSelf } from "./tour_utils";

registry.category("web_tour.tours").add("self_order_after_meal_product_tour", {
    test: true,
    steps: () => [
        // Verify if the self is open
        PosSelf.check.isNotNotification(),
        PosSelf.check.isNotPrimaryBtn("My Orders"),

        // Add some products
        PosSelf.action.clickPrimaryBtn("View Menu"),
        ...PosSelf.action.addProduct("Desk Stand with Screen", 15),
        ...PosSelf.action.addProduct("Office Chair Black", 3),
        ...PosSelf.action.addProduct("Desk Combination", 7),

        // Check if products in the products list have their quantity
        // They should have because in "meal" mode we add products always to the same order
        PosSelf.check.isProductQuantity("Desk Stand with Screen", 15),
        PosSelf.check.isProductQuantity("Office Chair Black", 3),
        PosSelf.check.isProductQuantity("Desk Combination", 7),

        // Check if product price are shown.
        PosSelf.check.isProductPrice("Cherry Pie", "13.80"),
        PosSelf.check.isProductPrice("Butter Croissant", "1.38"),
        PosSelf.check.isProductPrice("Tiger white loaf", "3.16"),
    ],
});
