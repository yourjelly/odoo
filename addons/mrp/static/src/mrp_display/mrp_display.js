/** @odoo-module */

import { Layout } from "@web/search/layout";
import { useService } from "@web/core/utils/hooks";
import { useModel } from "@web/views/model";
import { RelationalModel } from "@web/views/relational_model";

const { Component } = owl;

export class MrpDisplay extends Component {
    static template = "mrp.MrpDisplay";
    static components = { Layout };
    static props = {
        resModel: String,
        action: { type: Object, optional: true },
        comparison: { validate: () => true },
        fields: { type: Object },
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

        this.model = useModel(RelationalModel, {
            resModel: this.props.resModel,
            fields: this.props.fields,
            rootType: "list",
            activeFields: this.props.fields,
        });
    }
}
