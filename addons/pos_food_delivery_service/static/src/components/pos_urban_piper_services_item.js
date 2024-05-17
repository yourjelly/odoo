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
        const order = await this.pos.getServerOrders();
        const searchDetails = { fieldName: "DELIVERY_PARTNER", searchTerm: "Zomato" };
        this.pos.showScreen("TicketScreen", {
            stateOverride: { filter: "DELIVERY", search: searchDetails, destinationOrder: order },
        });
    }

    // async goToOrders(delieveryProvider) {
    //     const order = await this.pos.getServerOrders();
    //     // const stateOverride = {
    //     //     search: {
    //     //         fieldName: "BRAND",
    //     //         searchTerm: delieveryProvider,
    //     //     },
    //     //     filter: delieveryProviderHasActiveOrders ? "" : "ACTIVE_ORDERS",
    //     // };
    //     // this.pos.showScreen("TicketScreen", { stateOverride });
    //     const searchDetails = { fieldName: "BRAND", searchTerm: delieveryProvider };
    //     this.pos.showScreen("TicketScreen", {
    //         stateOverride: {
    //             filter: "DELIVERY",
    //             search: searchDetails,
    //             destinationOrder: order,
    //         },
    //     });
    // }
}
