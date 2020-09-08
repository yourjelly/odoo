odoo.define("poc.PivotAction", function (require) {
    "use strict";

    const Action = require("poc.Action");
    const PivotView = require("poc.PivotView");
    const { _lt } = require("web.core");
    const { GROUPABLE_TYPES } = require("web.searchUtils");


    class PivotAction extends Action {
        buildConfigs() {
            super.buildConfigs();

            const activeMeasures = []; // Store the defined active measures
            const colGroupBys = []; // Store the defined group_by used on cols
            const rowGroupBys = []; // Store the defined group_by used on rows
            const measures = {}; // All the available measures
            const groupableFields = {}; // The fields which can be used to group data
            const widgets = {}; // Wigdets defined in the arch
            const additionalMeasures = this.props.viewOptions.additionalMeasures || [];
            const fields = this.fields;

            //Compute the measures and the groupableFields
            for (const name of Object.keys(fields)) {
                const field = fields[name];
                if (name !== 'id' && field.store === true) {
                    if (['integer', 'float', 'monetary'].includes(field.type) || additionalMeasures.includes(name)) {
                        measures[name] = field;
                    }
                    if (GROUPABLE_TYPES.includes(field.type)) {
                        groupableFields[name] = field;
                    }
                }
            }
            measures.__count = fields.__count;

            for (const field of this.arch.children) {
                let name = field.get("name").raw;

                // Remove invisible fields from the measures
                if (field.get("invisible").pyEval) {
                    delete measures[name];
                    continue;
                }
                const interval = field.get("interval");
                if (interval.isNotNull) {
                    name += ':' + interval.raw;
                }
                const widget = field.get("widget");
                if (widget.isNotNull) {
                    widgets[name] = widget.raw;
                }
                // add active measures to the measure list.  This is very rarely
                // necessary, but it can be useful if one is working with a
                // functional field non stored, but in a model with an overrided
                // read_group method.  In this case, the pivot view could work, and
                // the measure should be allowed.  However, be careful if you define
                // a measure in your pivot view: non stored functional fields will
                // probably not work (their aggregate will always be 0).
                const type = field.get("type").raw;
                if (type === 'measure' && !(name in measures)) {
                    measures[name] = fields[name];
                }
                const string = field.get("string");
                if (string.isNotNull && name in measures) {
                    measures[name].string = string.raw;
                }
                if (type === 'measure' || field.has("operator")) {
                    activeMeasures.push(name);
                    measures[name] = fields[name];
                }
                if (type === 'col') {
                    colGroupBys.push(name);
                }
                if (type === 'row') {
                    rowGroupBys.push(name);
                }
            }
            if (!activeMeasures.length || this.arch.has("display_quantity")) {
                activeMeasures.splice(0, 0, '__count');
            }

            this.configs.load.measures = activeMeasures;
            this.configs.load.colGroupBys = this.env.device.isMobile ? [] : colGroupBys;
            this.configs.load.rowGroupBys = rowGroupBys;
            this.configs.load.fields = fields;
            this.configs.load.default_order = this.props.viewOptions.default_order || this.arch.get("default_order").raw;
            this.configs.load.groupableFields = groupableFields;

            this.configs.view.widgets = widgets;
            this.configs.view.disableLinking = this.arch.has("disable_linking");
            
            this.configs.view.title = this.props.viewOptions.title || this.arch.get("string").raw || this.env._t("Untitled");
            this.configs.viewController.measures = measures;
            this.configs.viewController.activeMeasures = activeMeasures;

            // retrieve form and list view ids from the action to open those views
            // when a data cell of the pivot view is clicked
            this.configs.view.views = [
                _findView(this.actionViews, 'list'),
                _findView(this.actionViews, 'form'),
            ];

            function _findView(views, viewType) {
                const view = views.find(view => {
                    return view.type === viewType;
                });
                return [view ? view.viewID : false, viewType];
            }
        }

        get fields() {
            return Object.assign({}, super.fields, {
                __count: { string: this.env._t("Count"), type: "integer" },
            });
        }
    }
    Object.assign(PivotAction, {
        display_name: _lt("Pivot"),
        viewType: "pivot",
        icon: 'fa-table',
        searchMenuTypes: ['filter', 'groupBy', 'comparison', 'favorite'],
    });
    Object.assign(PivotAction.components, {
        View: PivotView,
    });

    return PivotAction;
});
