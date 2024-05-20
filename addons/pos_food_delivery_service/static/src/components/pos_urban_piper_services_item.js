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

    async showDeliverooOrders(deliveryProvider) {
        const searchDetails = { fieldName: "DELIVERY_PARTNER", searchTerm: deliveryProvider };
        this.pos.showScreen("TicketScreen", {
            stateOverride: { search: searchDetails },
        });
    }
}
