import { Component } from "@odoo/owl";
import { useSelfOrder } from "@pos_self_order/app/services/self_order_service";
import { useService } from "@web/core/utils/hooks";

export class EatingLocationPage extends Component {
    static template = "pos_self_order.EatingLocationPage";
    static props = {};

    setup() {
        this.selfOrder = useSelfOrder();
        this.router = useService("router");
    }

    back() {
        this.router.navigate("default");
    }

    selectLocation(loc) {
        const preset =
            loc === "out"
                ? this.selfOrder.config.self_ordering_takeaway_preset_out
                : this.selfOrder.config.self_ordering_takeaway_preset_in;
        this.selfOrder.currentOrder.setPreset(preset);
        this.router.navigate("product_list");
    }
}
