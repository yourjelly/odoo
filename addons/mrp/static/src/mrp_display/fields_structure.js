/** @odoo-module */

export const fieldsStructure = {
    "mrp.production": [
        "name",
        "product_id",
        "workorder_ids",
        "move_raw_ids",
        "product_qty",
        "state",
    ],
    "mrp.workorder": [
        "move_raw_ids",
        "name",
        "operation_note",
        "product_id",
        "qty_production",
        "state",
        "workcenter_id",
        "worksheet_type",
    ],
    "stock.move": ["product_id", "product_uom_qty", "raw_material_production_id", "quantity_done"],
};
