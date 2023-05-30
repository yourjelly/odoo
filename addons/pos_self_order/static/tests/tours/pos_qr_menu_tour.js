/** @odoo-module **/

import { registry } from "@web/core/registry";
import { PosSelf } from "./tour_utils";

// TODO: write a test to check only the menu is displayed when the restaurant is closed
registry.category("web_tour.tours").add("pos_qr_menu_tour", {
    test: true,
    steps: [
        PosSelf.check.isNotPrimaryBtn("My Orders"),
        PosSelf.check.isPrimaryBtn("View Menu"),
        PosSelf.action.clickPrimaryBtn("View Menu"),
        ...PosSelf.check.cannotAddProduct("Office Chair"),
        PosSelf.action.clickBack(),
        ...PosSelf.check.cannotAddProduct("Office Chair Black"),
        PosSelf.action.clickBack(),
        ...PosSelf.check.cannotAddProduct("Conference Chair (Aluminium)"),
        PosSelf.action.clickBack(),
        PosSelf.check.isNotPrimaryBtn("Review"),
    ],
});
