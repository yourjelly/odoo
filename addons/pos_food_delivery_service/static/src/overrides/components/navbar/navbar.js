import { Navbar } from "@point_of_sale/app/navbar/navbar";
import { patch } from "@web/core/utils/patch";
import { PosUrbanPiperServices } from "../../../components/pos_urban_piper_services";
import { onWillStart, useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

patch(Navbar, {
    components: { ...Navbar.components, PosUrbanPiperServices },
});

patch(Navbar.prototype, {
    /**
     * @override
     */
    setup() {
        super.setup();
        this.sound = useService('sound');
        this.state = useState({
            posOrderCount: 0,
            posOrderData: [],
        });
        this.posOrderNotify = useService("pos_order_notify");
        this.posOrderNotify.notify(this.onNotify.bind(this), this.pos.config.id);
        this.state.posOrderCount = this.pos.models["pos.order"].filter((o) => !o.finalized && o.delivery_partner).length;
    },

    onNotify(count, brandName) {
        this.state.posOrderCount += count;
        this.state.posOrderData.push({
            id: Math.random(),
            name: brandName,
        });
        this.sound.play("notification");
        this.notification.add(
            "Order arrived",
            {
                type: "info",
            }
        );
    },
})
