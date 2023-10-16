/** @odoo-module */

import { PosStore } from "@point_of_sale/app/store/pos_store";
import { Order } from "@point_of_sale/app/store/models";
import { patch } from "@web/core/utils/patch";

patch(PosStore.prototype, {
    is_colombian_country() {
        return this.company.country?.code === "CO";
    },
});

patch(Order.prototype, {
    getOrderScreenValues(printing=false) {
        const values = super.getOrderScreenValues(...arguments);
        values.l10n_co_dian = this.get_l10n_co_dian();
        return values;
    },
    set_l10n_co_dian(l10n_co_dian) {
        this.l10n_co_dian = l10n_co_dian;
    },
    get_l10n_co_dian() {
        return this.l10n_co_dian;
    },
    wait_for_push_order() {
        var result = super.wait_for_push_order(...arguments);
        result = Boolean(result || this.pos.is_colombian_country());
        return result;
    },
});
