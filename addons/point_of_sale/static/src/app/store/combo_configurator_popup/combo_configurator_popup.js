/** @odoo-module */
import { AbstractAwaitablePopup } from "@point_of_sale/app/popup/abstract_awaitable_popup";
import { useState } from "@odoo/owl";
import { usePos } from "../pos_hook";

export class ComboConfiguratorPopup extends AbstractAwaitablePopup {
    static template = "point_of_sale.ComboConfiguratorPopup";

    setup() {
        super.setup();
        this.pos = usePos();
        this.state = useState({
            combo: Object.fromEntries(
                this.props.product.combo_ids.map((elem) => [elem, 0])
            ),
        });
    }

    /**
     * @returns {number[]}
     */
    getPayload() {
        // FIXME: it would have been better to use a t-model.number
        // instead of parseInt, but t-model.number does not seem to work
        return Object.values(this.state.combo)
            .filter((x) => x)
            .map((x) => parseInt(x));
    }
}
