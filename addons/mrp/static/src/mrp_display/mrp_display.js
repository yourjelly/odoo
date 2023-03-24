/** @odoo-module */

import { Layout } from "@web/search/layout";
import { useService } from "@web/core/utils/hooks";
import { RelationalModel } from "@web/views/relational_model";
import { useModel } from "@mrp/mrp_display/model";

const { Component, useSubEnv } = owl;

export class MrpDisplay extends Component {
    static template = "mrp.MrpDisplay";
    static components = { Layout };
    static buttonTemplate = "mrp.MrpDisplayButtonTemplate";
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
            controlPanel: { "bottom-right": false, "bottom-left": false, "top-middle": true },
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

    get workorders() {
        return this.mrp_workorder.root.records;
    }

    get workcenterButtons() {
        // Problème du moment. Ca ne se refresh pas
        const countByWorkcenter = this.workorders.reduce((workcenterButtons, workorder) => {
            const name = workorder.data.workcenter_id[1];
            workcenterButtons[name] = (workcenterButtons[name] || 0) + 1;
            return workcenterButtons;
        }, {});
        return Object.entries(countByWorkcenter);
    }
}
