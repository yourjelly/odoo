/** @odoo-module */

export const fieldsStructure = {
    "mrp.production": [
        "move_raw_ids",
        "name",
        "product_id",
        "product_qty",
        "state",
        "workorder_ids",
    ],
    "mrp.workorder": [
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
    "stock.move": ["product_id", "product_uom_qty", "quantity_done", "raw_material_production_id"],
};
