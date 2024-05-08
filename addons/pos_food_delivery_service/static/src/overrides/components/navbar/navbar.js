import { Navbar } from "@point_of_sale/app/navbar/navbar";
import { patch } from "@web/core/utils/patch";
import { PosOrderCount } from "@pos_food_delivery_service/components/pos_order_count";
import { useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

patch(Navbar, {
    components: { ...Navbar.components, PosOrderCount },
});

patch(Navbar.prototype, {
    /**
     * @override
     */
    setup() {
        super.setup();
        this.state = useState({
            posOrderCount: 1,
        });
        this.posOrderNotify = useService("pos_order_notify");
        this.posOrderNotify.notify(this.onNotify.bind(this), this.pos.config.id);
    },

    onNotify(count) {
        this.state.posOrderCount = count;
        this.notification.add(
            "Order arrived",
                {
                    type: "info",
                }
        );
    },
})
