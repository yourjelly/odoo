/** @odoo-module */

import { Layout } from "@web/search/layout";
import { useService } from "@web/core/utils/hooks";
import { useModels } from "@mrp/mrp_display/model";
import { ControlPanelButtons } from "@mrp/mrp_display/control_panel";
import { MrpDisplayRecord } from "./mrp_display_record";
import { MrpDisplayMenuPopup } from "./mrp_display_menu_popup";
import { RelationalModel } from "@web/views/relational_model";

const { Component, onWillStart, useState } = owl;

export class MrpDisplay extends Component {
    static template = "mrp.MrpDisplay";
    static components = { Layout, ControlPanelButtons, MrpDisplayRecord, MrpDisplayMenuPopup };
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
        this.userService = useService("user");
        this.actionService = useService("action");

        this.workcenterButtons = [];
        this.display = {
            ...this.props.display,
            controlPanel: { "bottom-right": false, "bottom-left": false, "top-middle": true },
            searchPanel: true,
        };
        this.state = useState({
            activeResModel: this.props.resModel,
            activeWorkcenter: false,
            displayMenuPopup: false,
        });

        const paramsList = [];
        for (const { resModel, fields } of this.props.models) {
            const params = { resModel, fields, rootType: "list", activeFields: fields };
            paramsList.push(params);
        }
        const models = useModels(RelationalModel, paramsList);
        for (const model of models) {
            const resModelName = model.rootParams.resModel.replaceAll(".", "_");
            this[resModelName] = model;
        }

        onWillStart(async () => {
            this.group_mrp_routings = await this.userService.hasGroup("mrp.group_mrp_routings");
        });
    }

    get workorders() {
        const workorders = this.mrp_workorder.root.records;
        const statesComparativeValues = {
            // Smallest value = first. Biggest value = last.
            progress: 0,
            ready: 1,
            pending: 2,
            waiting: 3,
        };
        workorders.sort((wo1, wo2) => {
            const v1 = statesComparativeValues[wo1.data.state];
            const v2 = statesComparativeValues[wo2.data.state];
            return v1 > v2 ? 1 : v1 < v2 ? -1 : 0;
        });
        return workorders;
    }

    getRawMoves(record) {
        if (this.state.activeResModel === "mrp.workorder") {
            return this.stock_move.root.records.filter((move) =>
                record.data.move_raw_ids.currentIds.includes(move.resId)
            );
        }
        return this.stock_move.root.records.filter(
            (move) => move.data.raw_material_production_id?.[0] === record.resId
        );
    }

    getProductionWorkorders(record) {
        if (this.state.activeResModel === "mrp.production") {
            return this.mrp_workorder.root.records.filter(
                (wo) => wo.data.production_id?.[0] === record.resId
            );
        }
        return [];
    }

    get relevantRecords() {
        if (this.state.activeResModel === "mrp.workorder") {
            return this.mrp_workorder.root.records.filter(
                (wo) => wo.data.workcenter_id[0] === this.state.activeWorkcenter
            );
        }
        return this.mrp_production.root.records;
    }

    selectWorkcenter(workcenterId) {
        this.state.activeWorkcenter = Number(workcenterId);
        this.state.activeResModel = workcenterId ? "mrp.workorder" : "mrp.production";
    }

    displayMenuPopup(record) {
        this.state.displayMenuPopup = true;
        this.menuPopupRecord = record;
    }

    async closeMenuPopup(record) {
        await record.load();
        this.state.displayMenuPopup = false;
        this.menuPopupRecord = false;
    }

    toggleSearchPanel() {
        this.display.searchPanel = !this.display.searchPanel;
        this.render(true);
    }
}
