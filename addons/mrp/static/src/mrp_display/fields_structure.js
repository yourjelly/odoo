/** @odoo-module */

import { StockMoveModel, MrpProductionModel, MrpWorkorderModel } from "./mrp_relational_model";

export const fieldsStructure = [
    {
        resModel: "mrp.production",
        fieldNames: ["move_raw_ids", "name", "product_id", "product_qty", "state", "workorder_ids"],
        relationalModel: MrpProductionModel,
    },
    {
        resModel: "mrp.workorder",
        fieldNames: [
            "duration",
            "move_raw_ids",
            "name",
            "operation_note",
            "product_id",
            "production_id",
            "qty_production",
            "state",
            "workcenter_id",
            "worksheet_type",
            "is_user_working",
        ],
        relationalModel: MrpWorkorderModel,
    },
    {
        resModel: "stock.move",
        fieldNames: [
            "product_id",
            "product_uom_qty",
            "quantity_done",
            "raw_material_production_id",
        ],
        relationalModel: StockMoveModel,
    },
];
