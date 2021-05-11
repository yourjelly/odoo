/** @odoo-module **/

import { _lt } from "@web/core/l10n/translation";
import { CallbackRecorder, useSetupAction } from "@web/webclient/actions/action_hook";
import { ControlPanel } from "@web/search/control_panel/control_panel";
import { evaluateExpr } from "@web/core/py_js/py";
import { GraphModel, MODES } from "./graph_model";
import { GraphRenderer } from "./graph_renderer";
import { GROUPABLE_TYPES } from "@web/search/utils/misc";
import { GroupByMenu } from "@web/search/group_by_menu/group_by_menu";
import { registry } from "@web/core/registry";
import { sortBy } from "@web/core/utils/arrays";
import { useDebugMenu } from "@web/core/debug/debug_menu";
import { useModel } from "@web/core/model";
import { useService } from "@web/core/service_hook";
import { XMLParser } from "@web/core/utils/xml";

const viewRegistry = registry.category("views");

const { Component } = owl;

const ORDERS = ["ASC", "DESC", null];

export class GraphArchParser extends XMLParser {
    parse(arch, fields = {}) {
        const metaData = { fields, fieldModif: {} };
        if (!arch) {
            return metaData;
        }
        this.visitXML(arch, (node) => {
            switch (node.tagName) {
                case "graph":
                    if (node.hasAttribute("disable_linking")) {
                        metaData.disableLinking = Boolean(
                            evaluateExpr(node.getAttribute("disable_linking"))
                        );
                    }
                    if (node.hasAttribute("stacked")) {
                        metaData.stacked = Boolean(evaluateExpr(node.getAttribute("stacked")));
                    }
                    const mode = node.getAttribute("type");
                    if (mode && MODES.includes(mode)) {
                        metaData.mode = mode;
                    }
                    const order = node.getAttribute("order");
                    if (order && ORDERS.includes(order)) {
                        metaData.order = order;
                    }
                    const title = node.getAttribute("string");
                    if (title) {
                        metaData.title = title;
                    }
                    break;
                case "field":
                    let fieldName = node.getAttribute("name"); // exists (rng validation)
                    if (fieldName === "id") {
                        break;
                    }
                    const string = node.getAttribute("string");
                    if (string) {
                        if (!metaData.fieldModif[fieldName]) {
                            metaData.fieldModif[fieldName] = {};
                        }
                        metaData.fieldModif[fieldName].string = string;
                    }
                    const isInvisible = Boolean(
                        evaluateExpr(node.getAttribute("invisible") || "0")
                    );
                    if (isInvisible) {
                        if (!metaData.fieldModif[fieldName]) {
                            metaData.fieldModif[fieldName] = {};
                        }
                        metaData.fieldModif[fieldName].invisible = true;
                        break;
                    }
                    const isMeasure = node.getAttribute("type") === "measure";
                    if (isMeasure) {
                        if (!metaData.fieldModif[fieldName]) {
                            metaData.fieldModif[fieldName] = {};
                        }
                        metaData.fieldModif[fieldName].isMeasure = true;
                        // the last field with type="measure" (if any) will be used as measure else __count
                        metaData.measure = fieldName;
                    } else {
                        const { type } = metaData.fields[fieldName]; // exists (rng validation)
                        if (GROUPABLE_TYPES.includes(type)) {
                            let groupBy = fieldName;
                            const interval = node.getAttribute("interval");
                            if (interval) {
                                groupBy += `:${interval}`;
                            }
                            if (!metaData.groupBy) {
                                metaData.groupBy = [];
                            }
                            metaData.groupBy.push(groupBy);
                        }
                    }
                    break;
            }
        });
        return metaData;
    }
}

export class GraphView extends Component {
    setup() {
        this.actionService = useService("action");

        useDebugMenu("view", { component: this });

        const { additionalMeasures, arch, fields, state } = this.props;
        const loadParams = {};
        if (state) {
            Object.assign(loadParams, state);
        } else {
            const parser = new GraphArchParser();
            const propsFromArch = parser.parse(arch, fields);
            Object.assign(loadParams, this.props, propsFromArch); // I think we should not keep __exportState,... here
            const measures = [];
            for (const fieldName in fields) {
                const field = fields[fieldName];
                const { invisible, isMeasure, string } = loadParams.fieldModif[fieldName] || {};
                if (!["id", "__count"].includes(fieldName) && field.store === true) {
                    if (
                        (!invisible && ["integer", "float", "monetary"].includes(field.type)) ||
                        (!invisible && isMeasure) ||
                        additionalMeasures.includes(fieldName)
                    ) {
                        measures.push({
                            description: string || field.string,
                            fieldName,
                        });
                    }
                }
            }
            loadParams.measures = sortBy(measures, (m) => m.description.toLowerCase());
        }

        this.model = useModel({ Model: this.constructor.Model, loadParams });

        useSetupAction({
            exportState: () => this.model.metaData, // maybe its too much: what about __exportState__, breadcrumbs,... ?
            saveParams: () => this.saveParams(),
        });
    }

    /**
     * @returns {Object}
     */
    get controlPanelProps() {
        const { breadcrumbs, display, displayName, viewSwitcherEntries } = this.props;
        const controlPanelProps = { breadcrumbs, displayName, viewSwitcherEntries };
        controlPanelProps.display = display.controlPanel;
        return controlPanelProps;
    }

    /**
     * @param {CustomEvent} ev
     */
    onInspectDomainRecords(ev) {
        const { domain } = ev.detail;
        const { context, resModel, title } = this.model.metaData;

        const views = {};
        for (const [viewId, viewType] of this.props.views || []) {
            views[viewType] = viewId;
        }
        function getView(viewType) {
            return [views[viewType] || false, viewType];
        }
        const actionViews = [getView("list"), getView("form")];

        this.actionService.doAction(
            {
                context,
                domain,
                name: title,
                res_model: resModel,
                target: "current",
                type: "ir.actions.act_window",
                views: actionViews,
            },
            {
                viewType: "list",
            }
        );
    }

    /**
     * @param {CustomEvent} ev
     */
    onMeasureSelected(ev) {
        const { measure } = ev.detail.payload;
        this.model.updateMetaData({ measure });
    }

    /**
     * @param {"bar"|"line"|"pie"} mode
     */
    onModeSelected(mode) {
        this.model.updateMetaData({ mode });
    }

    /**
     * @returns {Object}
     */
    saveParams() {
        // expand context object? change keys?
        const { measure, groupBy, mode } = this.model.metaData;
        return {
            context: {
                graph_measure: measure,
                graph_mode: mode,
                graph_groupbys: groupBy.map((gb) => gb.spec),
            },
        };
    }

    /**
     * @param {"ASC"|"DESC"} order
     */
    toggleOrder(order) {
        const { order: currentOrder } = this.model.metaData;
        const nextOrder = currentOrder === order ? null : order;
        this.model.updateMetaData({ order: nextOrder });
    }

    toggleStacked() {
        const { stacked } = this.model.metaData;
        this.model.updateMetaData({ stacked: !stacked });
    }
}

GraphView.template = "web.GraphView";
GraphView.buttonTemplate = "web.GraphView.Buttons";

GraphView.components = { GroupByMenu };

GraphView.defaultProps = {
    arch: `<graph/>`,
    breadcrumbs: [],
    context: {},
    display: {},
    domains: [{ arrayRepr: [], description: null }],
    fields: {},
    groupBy: [],
    searchViewId: false,
    viewId: false,
    useSampleModel: false,

    additionalMeasures: [],
    disableLinking: false,
    measure: "__count",
    mode: "bar",
    order: null,
    stacked: true,
};

GraphView.props = {
    resModel: String,

    arch: { type: String, optional: 1 },
    breadcrumbs: { type: Array, optional: 1 },
    __exportState__: { type: CallbackRecorder, optional: 1 },
    __saveParams__: { type: CallbackRecorder, optional: 1 },
    context: { type: Object, optional: 1 },
    display: { type: Object, optional: 1 },
    displayName: { type: String, optional: 1 },
    domains: { type: Array, elements: Object, optional: 1 },
    fields: { type: Object, elements: Object, optional: 1 },
    groupBy: { type: Array, elements: String, optional: 1 },
    noContentHelp: { type: String, optional: 1 },
    searchViewId: { type: [Number, false], optional: 1 },
    state: { type: Object, optional: 1 },
    viewId: { type: [Number, false], optional: 1 },
    views: { type: Array, element: Array, optional: 1 },
    viewSwitcherEntries: { type: Array, optional: 1 },
    useSampleModel: { type: Boolean, optional: 1 },

    additionalMeasures: { type: Array, elements: String, optional: 1 },
    disableLinking: { type: Boolean, optional: 1 },
    measure: { type: String, optional: 1 },
    mode: { validate: (m) => MODES.includes(m), optional: 1 },
    order: { validate: (o) => ORDERS.includes(o), optional: 1 },
    stacked: { type: Boolean, optional: 1 },
    title: { type: String, optional: 1 },
};

GraphView.type = "graph";

GraphView.display_name = _lt("Graph");
GraphView.icon = "fa-bar-chart";
GraphView.multiRecord = true;

GraphView.Model = GraphModel;
GraphView.Renderer = GraphRenderer;
GraphView.ControlPanel = ControlPanel;

GraphView.searchMenuTypes = ["filter", "groupBy", "comparison", "favorite"];

viewRegistry.add("graph", GraphView);
