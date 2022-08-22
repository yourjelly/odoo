/** @odoo-module */

import { DynamicRecordList } from "@web/views/relational_model";
import { patch } from "@web/core/utils/patch";
import { browser } from "@web/core/browser/browser";


patch(DynamicRecordList.prototype, "invalidateCache", {
    invalidateCache() {
        this._super(...arguments);
        if (this.model.root.resModel === 'stock.warehouse' && !browser.localStorage.getItem('running_tour')) {
            this.model.action.doAction("reload_context");
        }
    },
});
