/** @odoo-module **/

import { registry } from "@web/core/registry";
import { FloatField } from "@web/views/fields/float/float_field";

export class QtyDone extends FloatField {
    async onFocusout() {
        await new Promise((resolve) => {
            this.env.model.env.bus.trigger("STOCK_MOVE:UPDATED", { resolve });
        });
    }
}

QtyDone.template = "stock.QtyDone";
registry.category("fields").add("qty_done", QtyDone);
