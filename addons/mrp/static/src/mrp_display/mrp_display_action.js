/** @odoo-module */

import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { WithSearch } from "@web/search/with_search/with_search";
import { MrpDisplay } from "@mrp/mrp_display/mrp_display";

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
        this.resModel = "mrp.production";

        this.fieldsName = ["name", "product_id"];

        onWillStart(async () => {
            this.fields = await this.viewService.loadFields(this.resModel, {
                fieldNames: this.fieldsName,
            });
            for (const [fName, fInfo] of Object.entries(this.fields)) {
                this.fields[fName] = { ...defaultActiveField, ...fInfo };
            }

            const searchViews = await this.viewService.loadViews({
                resModel: this.resModel,
                views: [[false, "search"]],
            });
            this.withSearchProps = {
                resModel: this.resModel,
                searchViewArch: searchViews.views.search.arch,
                searchViewId: searchViews.views.search.id,
                searchViewFields: searchViews.fields,
                context: this.props.action.context,
            };
        });
    }
}

registry.category("actions").add("mrp_display", MrpDisplayAction);
