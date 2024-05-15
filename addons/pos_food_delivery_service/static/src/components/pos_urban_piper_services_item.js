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

    async goToOrders(delieveryProvider) {
        const delieveryProviderHasActiveOrders = await this.pos.getServerOrders()
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
