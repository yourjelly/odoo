/** @odoo-module **/

import { registry } from "@web/core/registry";
import { PosSelf } from "./tour_utils";

registry.category("web_tour.tours").add("self_order_tour", {
    test: true,
    steps: [
        // Verify if the self is open
        PosSelf.check.isOpen(),
        PosSelf.check.isNotPrimaryBtn("My Orders"),

        // Add some products
        PosSelf.action.clickPrimaryBtn("View Menu"),
        ...PosSelf.action.addProduct("Office Chair", 15),
        ...PosSelf.action.addProduct("Office Chair Black", 3),
        ...PosSelf.action.addProduct("Conference Chair (Aluminium)", 7),

        // Check if the products are in the cart
        PosSelf.action.clickPrimaryBtn("Review"),
        PosSelf.check.isOrderline("Office Chair", 15),
        PosSelf.check.isOrderline("Office Chair Black", 3),
        PosSelf.check.isOrderline("Conference Chair (Aluminium)", 7),
        PosSelf.action.clickPrimaryBtn("Order"),

        // Check if the orderlines was sent to the server
        // We can check whether the order has been correctly sent to the server here,
        // as this screen (My orders) only displays data from the server.
        PosSelf.check.isPrimaryBtn("My Orders"),
        PosSelf.action.clickPrimaryBtn("My Orders"),
        PosSelf.check.isOrderline("Office Chair", 15),
        PosSelf.check.isOrderline("Office Chair Black", 3),
        PosSelf.check.isOrderline("Conference Chair (Aluminium)", 7),
        PosSelf.action.clickBack(),

        // Check if products in the products list have their quantity
        // They should have because in "meal" mode we add products always to the same order
        PosSelf.action.clickPrimaryBtn("View Menu"),
        PosSelf.check.isProductQuantity("Office Chair", 15),
        PosSelf.check.isProductQuantity("Office Chair Black", 3),
        PosSelf.check.isProductQuantity("Conference Chair (Aluminium)", 7),

        // In "meal" mode we add products always to the same order until we pay it
        ...PosSelf.action.addProduct("Corner Desk Left Sit", 5),
        ...PosSelf.action.addProduct("Large Desk", 23),
        PosSelf.action.clickPrimaryBtn("Review"),
        PosSelf.check.isOrderline("Office Chair", 15),
        PosSelf.check.isOrderline("Office Chair Black", 3),
        PosSelf.check.isOrderline("Conference Chair (Aluminium)", 7),
        PosSelf.check.isOrderline("Corner Desk Left Sit", 5),
        PosSelf.check.isOrderline("Large Desk", 23),
        PosSelf.action.clickPrimaryBtn("Order"),

        PosSelf.check.isPrimaryBtn("My Orders"),
        PosSelf.action.clickPrimaryBtn("My Orders"),
        PosSelf.check.isOrderline("Office Chair", 15),
        PosSelf.check.isOrderline("Office Chair Black", 3),
        PosSelf.check.isOrderline("Conference Chair (Aluminium)", 7),
        PosSelf.check.isOrderline("Corner Desk Left Sit", 5),
        PosSelf.check.isOrderline("Large Desk", 23),
        PosSelf.action.clickBack(),
    ],
});
