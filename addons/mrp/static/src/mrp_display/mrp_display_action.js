/** @odoo-module */

import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { WithSearch } from "@web/search/with_search/with_search";
import { MrpDisplay } from "@mrp/mrp_display/mrp_display";
import { MrpDisplayControlPanel } from "@mrp/mrp_display/control_panel";
import { fieldsStructure } from "@mrp/mrp_display/fields_structure";

const { Component, onWillStart } = owl;

// from record.js
const defaultActiveField = { attrs: {}, options: {}, domain: "[]", string: "" };

export class MrpDisplayAction extends Component {
    static template = "mrp.MrpDisplayAction";
    static components = { WithSearch, MrpDisplay };
    static props = {
        "*": true,
    };

    setup() {
        this.viewService = useService("view");
        this.orm = useService("orm");
        this.resModel = "mrp.production";
        this.models = {};

        // TODO Maybe it should be in MrpDisplay directly
        this.env.config.ControlPanel = MrpDisplayControlPanel;

        onWillStart(async () => {
            for (const [model, fieldsName] of Object.entries(fieldsStructure)) {
                const fields = await this.viewService.loadFields(model, {
                    fieldNames: fieldsName,
                });
                for (const [fName, fInfo] of Object.entries(fields)) {
                    fields[fName] = { ...defaultActiveField, ...fInfo };
                }
                this.models[model] = fields;
            }

            const viewId = await this.orm.search("ir.ui.view", [
                ["model_data_id", "=", "mrp_production_view_mrp_display"],
            ]);
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
