import { usePos } from "@point_of_sale/app/store/pos_hook";
import { PosUrbanPiperServicesItem } from "./pos_urban_piper_services_item";
import { Component, useState, useExternalListener, useEffect } from "@odoo/owl";

export class PosUrbanPiperServices extends Component {
    static template = "pos_food_delivery_service.PosUrbanPiperServices";
    static components = {
        PosUrbanPiperServicesItem,
    };
    static props = {
        orderCount: { type: Number, optional: true }
    };
    setup() {
        this.pos = usePos();
        this.state = useState({ isMenuOpened: false });
        useExternalListener(window, "mouseup", this.onOutsideClick);
        
        useEffect(
            () => {
                (async() => {
                    this.orderStatus = await this.pos.data.call("pos.config", "get_urbanpiper_order_count", [""]);
                })();
            },
            () => [this.props.orderCount]
        );
    }

    isOrderCountMenuClosed() {
        return !this.state.isMenuOpened;
    }

    openMenu() {
        this.state.isMenuOpened = true;
    }

    closeMenu() {
        this.state.isMenuOpened = false;
    }

    onOutsideClick() {
        if (this.state.isMenuOpened) {
            this.state.isMenuOpened = false;
        }
    }
}
