/** @odoo-module */

import { Layout } from "@web/search/layout";
import { useService } from "@web/core/utils/hooks";
import { RelationalModel } from "@web/views/relational_model";
import { useModel } from "@mrp/mrp_display/model";

const { Component, useSubEnv } = owl;

export class MrpDisplay extends Component {
    static template = "mrp.MrpDisplay";
    static components = { Layout };
    static props = {
        resModel: String,
        action: { type: Object, optional: true },
        comparison: { validate: () => true },
        models: { type: Object },
        domain: { type: Array },
        display: { type: Object, optional: true },
        context: { type: Object, optional: true },
        groupBy: { type: Array, element: String },
        orderBy: { type: Array, element: Object },
    };

    setup() {
        this.viewService = useService("view");
        this.display = {
            ...this.props.display,
            controlPanel: { "bottom-right": false, "bottom-left": false },
            searchPanel: true,
        };
        for (const [resModel, fields] of Object.entries(this.props.models)) {
            const resModelName = resModel.replaceAll(".", "_");
            const model = useModel(RelationalModel, {
                resModel: resModel,
                fields: fields,
                rootType: "list",
                activeFields: fields,
            });
            if (resModel == this.props.resModel) {
                useSubEnv({ [resModelName]: model });
            }
            this[resModelName] = model;
        }
    }
}
