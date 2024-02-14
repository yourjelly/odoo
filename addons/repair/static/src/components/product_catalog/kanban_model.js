/** @odoo-module */

import { patch } from "@web/core/utils/patch";
import { ProductCatalogKanbanModel } from "@product/product_catalog/kanban_model";

patch(ProductCatalogKanbanModel.prototype, {
    _getOrderLinesInfoParams(params, productIds) {
        return {
            ...super._getOrderLinesInfoParams(params, productIds),
            parent_model: params.context?.product_catalog_order_model,
        }
    }
});
