/** @odoo-module */

import { patch } from "@web/core/utils/patch";
import { PosStore } from "@point_of_sale/app/store/pos_store";

patch(PosStore.prototype, {
    async _getOrdersJson() {
        if (this.config.self_ordering_mode === "kiosk") {
            return await this.orm.call("pos.order", "export_for_ui_shared_order", [], {
                config_id: this.config.id,
            });
        } else {
            return await super._getOrdersJson();
        }
    },
});
