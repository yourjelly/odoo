/** @odoo-module */

import { Layout } from "@web/search/layout";
import { useService } from "@web/core/utils/hooks";
import { RelationalModel } from "@web/views/relational_model";
import { useModels } from "@mrp/mrp_display/model";
import { ControlPanelButtons } from "@mrp/mrp_display/control_panel";
import { MrpDisplayRecord } from "./mrp_display_record";

const { Component, useState } = owl;

export class MrpDisplay extends Component {
    static template = "mrp.MrpDisplay";
    static components = { Layout, ControlPanelButtons, MrpDisplayRecord };
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

        this.workcenterButtons = [];
        this.display = {
            ...this.props.display,
            controlPanel: { "bottom-right": false, "bottom-left": false, "top-middle": true },
            searchPanel: true,
        };
        this.state = useState({
            activeResModel: this.props.resModel,
            activeWorkcenter: false,
        });

        const params = [];
        for (const [resModel, fields] of Object.entries(this.props.models)) {
            params.push({
                resModel: resModel,
                fields: fields,
                rootType: "list",
                activeFields: fields,
            });
        }
        const models = useModels(RelationalModel, params);
        for (const model of models) {
            const resModelName = model.rootParams.resModel.replaceAll(".", "_");
            this[resModelName] = model;
        }
    }

    get workorders() {
        return this.mrp_workorder.root.records;
    }

    getRawMoves(record) {
        return this.stock_move.root.records.filter(
            (move) => move.data.raw_material_production_id?.[0] === record.resId
        );
    }

    getWorkorders(record) {
        return this.workorders.filter((wo) =>
            record.data.workorder_ids.currentIds.includes(wo.resId)
        );
    }

    selectWorkcenter(workcenterId) {
        this.state.activeWorkcenter = workcenterId;
        if (workcenterId) {
            this.state.activeResModel = "mrp.workorder";
        } else {
            this.state.activeResModel = "mrp.production";
        }
    }
}
