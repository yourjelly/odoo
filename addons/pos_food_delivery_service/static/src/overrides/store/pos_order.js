import { PosOrder } from "@point_of_sale/app/models/pos_order";
import { patch } from "@web/core/utils/patch";

patch(PosOrder.prototype, {
    get_brand_name() {
        return this.brand_id ? this.brand_id : "";
    }
});
