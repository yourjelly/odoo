/** @odoo-module */

import { patch } from "@web/core/utils/patch";
import { ProductCatalogKanbanRecord } from "@product/product_catalog/kanban_record";
import { useSubEnv } from "@odoo/owl";

patch(ProductCatalogKanbanRecord.prototype, {
    setup() {
        super.setup();
        useSubEnv({
            childModel: this.props.record.context?.child_model
        })
    },

    _getUpdateQuantityAndGetPriceParams() {
        return {
            ...super._getUpdateQuantityAndGetPriceParams(),
            child_model: this.env.childModel,
        }
    }
});
