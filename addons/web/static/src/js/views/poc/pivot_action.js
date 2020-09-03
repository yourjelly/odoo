odoo.define("poc.PivotAction", function (require) {
    "use strict";

    const Action = require("poc.Action");
    // const PivotRenderer = require("web.PivotRenderer");
    const PivotModel = require("web.PivotModel");
    const { _lt } = require("web.core");
    const { GROUPABLE_TYPES } = require("web.searchUtils");
    const { useListener } = require("web.custom_hooks");


    class PivotRenderer extends owl.Component {
    }
    PivotRenderer.template = owl.tags.xml/*xml*/`
        <div>??</div>
    `;


    class PivotAction extends Action {
        constructor() {
            super(...arguments);

            useListener("closed_header_click", this._onClosedHeaderClicked);
            useListener("open_view", this._onOpenView);
            useListener("opened_header_click", this._onOpenedHeaderClicked);
            useListener("sort_rows", this._onSortRows);
            useListener("groupby_menu_selection", this._onGroupByMenuSelection);
        }

        extractParams() {
            const activeMeasures = []; // Store the defined active measures
            const colGroupBys = []; // Store the defined group_by used on cols
            const rowGroupBys = []; // Store the defined group_by used on rows
            const measures = {}; // All the available measures
            const groupableFields = {}; // The fields which can be used to group data
            const widgets = {}; // Wigdets defined in the arch
            const additionalMeasures = this.props.viewOptions.additionalMeasures || [];

            this.fields.__count = { string: this.env._t("Count"), type: "integer" };

            //Compute the measures and the groupableFields
            for (const name of Object.keys(this.fields)) {
                const field = this.fields[name];
                if (name !== 'id' && field.store === true) {
                    if (['integer', 'float', 'monetary'].includes(field.type) || additionalMeasures.includes(name)) {
                        measures[name] = field;
                    }
                    if (GROUPABLE_TYPES.includes(field.type)) {
                        groupableFields[name] = field;
                    }
                }
            }
            measures.__count = { string: this.env._t("Count"), type: "integer" };

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
                    measures[name] = this.fields[name];
                }
                const string = field.get("string");
                if (string.isNotNull && name in measures) {
                    measures[name].string = string.raw;
                }
                if (type === 'measure' || field.get("operator").exists) {
                    activeMeasures.push(name);
                    measures[name] = this.fields[name];
                }
                if (type === 'col') {
                    colGroupBys.push(name);
                }
                if (type === 'row') {
                    rowGroupBys.push(name);
                }
            }
            if (!activeMeasures.length || this.arch.get("display_quantity").exists) {
                activeMeasures.unshift('__count');
            }

            this.config.load.measures = activeMeasures;
            this.config.load.colGroupBys = this.env.device.isMobile ? [] : colGroupBys;
            this.config.load.rowGroupBys = rowGroupBys;
            this.config.load.fields = this.fields;
            this.config.load.default_order = this.props.viewOptions.default_order || this.arch.get("default_order").raw;
            this.config.load.groupableFields = groupableFields;

            const disableLinking = this.arch.get("disable_linking").exists;

            this.config.view.widgets = widgets;
            this.config.view.disableLinking = disableLinking;
            
            this.disableLinking = disableLinking;
            this.title = this.props.viewOptions.title || this.arch.get("string").raw || this.env._t("Untitled");
            this.measures = measures;

            // retrieve form and list view ids from the action to open those views
            // when a data cell of the pivot view is clicked
            this.views = [
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

        async _onClosedHeaderClicked(ev) {
            const cell = ev.detail.cell;
            const groupId = cell.groupId;
            const type = ev.detail.type;

            const group = {
                rowValues: groupId[0],
                colValues: groupId[1],
                type
            };

            const state = this.model.get({ raw: true });
            const groupValues = type === 'row' ? groupId[0] : groupId[1];
            const groupBys = type === 'row' ?
                state.rowGroupBys :
                state.colGroupBys;
            this.selectedGroup = group;
            if (groupValues.length < groupBys.length) {
                const groupBy = groupBys[groupValues.length];
                await this.model.expandGroup(this.selectedGroup, groupBy);
                this.update({}, { reload: false });
            }
        }
        _onOpenedHeaderClicked(ev) {
            this.model.closeGroup(ev.detail.cell.groupId, ev.detail.type);
            this.update({}, { reload: false });
        }
        async _onGroupByMenuSelection(ev) {
            ev.stopPropagation();

            let groupBy = ev.detail.field.name;
            const interval = ev.detail.interval;
            if (interval) {
                groupBy = groupBy + ':' + interval;
            }
            this.model.addGroupBy(groupBy, this.selectedGroup.type);
            await this.model.expandGroup(this.selectedGroup, groupBy);
            this.update({}, { reload: false });
        }
        _onOpenView(ev) {
            ev.stopPropagation();
            const cell = ev.detail;
            if (cell.value === undefined || this.disableLinking) {
                return;
            }

            const context = Object.assign({}, this.model.data.context);
            Object.keys(context).forEach(x => {
                if (x === 'group_by' || x.startsWith('search_default_')) {
                    delete context[x];
                }
            });

            const group = {
                rowValues: cell.groupId[0],
                colValues: cell.groupId[1],
                originIndex: cell.originIndexes[0]
            };

            const domain = this.model._getGroupDomain(group);

            this.env.bus.trigger('do-action', {
                action: {
                    type: 'ir.actions.act_window',
                    name: this.title,
                    res_model: this.modelName,
                    views: this.views,
                    view_mode: 'list',
                    target: 'current',
                    context: context,
                    domain: domain,
                },
            });
        }
        _onSortRows(ev) {
            this.model.sortRows({
                groupId: ev.detail.groupId,
                measure: ev.detail.measure,
                order: (ev.detail.order || 'desc') === 'asc' ? 'desc' : 'asc',
                originIndexes: ev.detail.originIndexes,
            });
            this.update({}, { reload: false });
        }
    }
    Object.assign(PivotAction, {
        display_name: _lt("Pivot"),
        viewType: "pivot",
        icon: 'fa-table',
        searchMenuTypes: ['filter', 'groupBy', 'comparison', 'favorite'],
    });
    Object.assign(PivotAction.components, {
        View: PivotRenderer,
        Model: PivotModel,
    });

    return PivotAction;
});
