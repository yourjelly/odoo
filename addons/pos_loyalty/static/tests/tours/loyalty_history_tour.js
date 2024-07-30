import * as PosLoyalty from "@pos_loyalty/../tests/tours/utils/pos_loyalty_util";
import * as ProductScreen from "@point_of_sale/../tests/tours/utils/product_screen_util";
import * as Dialog from "@point_of_sale/../tests/tours/utils/dialog_util";
import { registry } from "@web/core/registry";

registry.category("web_tour.tours").add("LoyaltyHistoryTour", {
    test: true,
    steps: () =>
        [
            Dialog.confirm("Open session"),

            // Add a product for partner_aaa
            ProductScreen.addOrderline("Whiteboard Pen", "1"),
            ProductScreen.clickPartnerButton(),
            ProductScreen.clickCustomer("AAA Test Partner"),
            PosLoyalty.orderTotalIs("10"),

            PosLoyalty.finalizeOrder("Cash", "10"),
        ].flat(),
});
