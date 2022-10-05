/** @odoo-module **/

import { Record, RelationalModel } from "@web/views/basic_relational_model";
import { Mutex } from "@web/core/utils/concurrency";

export class StockPickingAutoSaveRecord extends Record {
    setup(params, state) {
        super.setup(params, state);
        this.mutex = new Mutex();
    }

    async update(changes) {
        const record_prom = super.update(changes);
        if (this.resModel !== "stock.move" || !("quantity_done" in changes)) {
            return record_prom;
        }
        this.mutex.exec(async () => {
            await record_prom;
            await new Promise((resolve) => {
                this.model.env.bus.trigger("STOCK_MOVE:UPDATED", { resolve });
            });
            await new Promise((resolve) => {
                this.model.env.bus.trigger("STOCK_MOVE:SAVED", {
                    id: this.data.id,
                    product_id: this.data.product_id,
                    resolve,
                });
            });
            return record_prom;
        });
    }
}

export class StockPickingModel extends RelationalModel {}
StockPickingModel.Record = StockPickingAutoSaveRecord;
