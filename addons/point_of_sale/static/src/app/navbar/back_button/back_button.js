/** @odoo-module */

import { Component, useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { ProductScreen } from "@point_of_sale/app/screens/product_screen/product_screen";
import { TipScreen } from "@point_of_sale/app/screens/payment_screen/tip_screen/tip_screen";
import { usePos } from "@point_of_sale/app/store/pos_hook";

export class BackButton extends Component {
    static template = "point_of_sale.BackButton";

    setup() {
        this.pos = usePos();
        this.ui = useState(useService("ui"));
    }
    get floor() {
        return this.table?.floor;
    }
    get hasTable() {
        return this.table != null;
    }
    async backToFloorScreen() {
        if (this.pos.mainScreen.component && this.pos.config.module_pos_restaurant) {
            if (
                (this.pos.mainScreen.component === ProductScreen &&
                    this.pos.mobile_pane == "right") ||
                this.pos.mainScreen.component === TipScreen
            ) {
                this.pos.showScreen("FloorScreen", { floor: this.floor });
            } else {
                this.pos.mobile_pane = "right";
                this.pos.showScreen("ProductScreen");
            }
        } else {
            this.pos.mobile_pane = "right";
            this.pos.showScreen("ProductScreen");
        }
    }
}
