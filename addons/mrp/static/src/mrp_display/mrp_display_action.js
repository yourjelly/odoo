/** @odoo-module */

import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { WithSearch } from "@web/search/with_search/with_search";
import { MrpDisplay } from "@mrp/mrp_display/mrp_display";
import { MrpDisplayControlPanel } from "@mrp/mrp_display/control_panel";

const { Component, onWillStart } = owl;

// from record.js
const defaultActiveField = { attrs: {}, options: {}, domain: "[]", string: "" };

export class MrpDisplayAction extends Component {
    static template = "mrp.MrpDisplayAction";
    static components = { WithSearch, MrpDisplay };
    static props = {
        "*": true,
    };

    get fieldsStructure() {
        return {
            "mrp.production": [
                "show_serial_mass_produce",
                "move_raw_ids",
                "name",
                "product_id",
                "product_qty",
                "state",
                "workorder_ids",
                "product_tracking",
                "lot_producing_id",
            ],
            "mrp.workorder": [
                "duration",
                "is_user_working",
                "move_raw_ids",
                "name",
                "operation_note",
                "product_id",
                "production_id",
                "qty_production",
                "state",
                "workcenter_id",
                "worksheet_type",
            ],
            "stock.move": [
                "product_id",
                "product_uom_qty",
                "quantity_done",
                "raw_material_production_id",
            ],
        };
    }

    setup() {
        this.viewService = useService("view");
        this.orm = useService("orm");
        this.resModel = "mrp.production";
        this.models = [];

        // TODO Maybe it should be in MrpDisplay directly
        this.env.config.ControlPanel = MrpDisplayControlPanel;

        onWillStart(async () => {
            for (const [resModel, fieldNames] of Object.entries(this.fieldsStructure)) {
                const fields = await this.viewService.loadFields(resModel, { fieldNames });
                for (const [fName, fInfo] of Object.entries(fields)) {
                    fields[fName] = { ...defaultActiveField, ...fInfo };
                }
                this.models.push({ fields, resModel });
            }

            // const viewId = await this.orm.search("ir.ui.view", [
            //     ["model_data_id", "=", "mrp_production_view_mrp_display"],
            // ]);
            const viewId = false;
            const searchViews = await this.viewService.loadViews({
                resModel: this.resModel,
                views: [[viewId ? viewId[0] : false, "search"]],
            });
            this.withSearchProps = {
                resModel: this.resModel,
                searchViewArch: searchViews.views.search.arch,
                searchViewId: searchViews.views.search.id,
                searchViewFields: searchViews.fields,
                context: this.props.action.context,
                domain: [["state", "in", ["confirmed", "progress", "to_close"]]],
            };
        });
    }
}

registry.category("actions").add("mrp_display", MrpDisplayAction);
