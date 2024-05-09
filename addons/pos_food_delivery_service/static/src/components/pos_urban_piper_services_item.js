import { usePos } from "@point_of_sale/app/store/pos_hook";
import { Component } from "@odoo/owl";

export class PosUrbanPiperServicesItem extends Component {
    static template = "pos_food_delivery_service.PosUrbanPiperServicesItem";
    static components = {};
    static props = {
        orderCount: { type: Number, optional: true }
    };
    setup() {
        this.pos = usePos();
    }

    goToOrders(delieveryProvider) {
        const delieveryProviderHasActiveOrders = this.pos
            .get_order_list()
            .some((order) => order.brand_id?.name === delieveryProvider);
        const stateOverride = {
            search: {
                fieldName: "BRAND",
                searchTerm: delieveryProvider,
            },
            filter: delieveryProviderHasActiveOrders ? "" : "ACTIVE_ORDERS",
        };
        this.pos.showScreen("TicketScreen", { stateOverride });
    }
}
