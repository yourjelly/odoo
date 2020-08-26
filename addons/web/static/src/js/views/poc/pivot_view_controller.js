odoo.define("poc.PivotViewController", function (require) {
    "use strict";

    const ViewController = require("poc.ViewController");
    const PivotRenderer = require("web.PivotRenderer");
    const PivotModel = require("web.PivotModel");
    const { _lt } = require("web.core");
    const { GROUPABLE_TYPES } = require("web.searchUtils");
    const { useListener } = require("web.custom_hooks");


    class PivotViewController extends ViewController {
        constructor() {
            super(...arguments);

            useListener("closed_header_click", this._onClosedHeaderClicked);
            useListener("open_view", this._onOpenView);
            useListener("opened_header_click", this._onOpenedHeaderClicked);
            useListener("sort_rows", this._onSortRows);
            useListener("groupby_menu_selection", this._onGroupByMenuSelection);
        }

        extractParams(params) {

            const activeMeasures = []; // Store the defined active measures
            const colGroupBys = []; // Store the defined group_by used on cols
            const rowGroupBys = []; // Store the defined group_by used on rows
            const measures = {}; // All the available measures
            const groupableFields = {}; // The fields which can be used to group data
            const widgets = {}; // Wigdets defined in the arch
            const additionalMeasures = params.additionalMeasures || [];

            this.fields.__count = { string: this.env._t("Count"), type: "integer" };

            //Compute the measures and the groupableFields
            Object.keys(this.fields).forEach(name => {
                const field = this.fields[name];
                if (name !== 'id' && field.store === true) {
                    if (['integer', 'float', 'monetary'].includes(field.type) || additionalMeasures.includes(name)) {
                        measures[name] = field;
                    }
                    if (GROUPABLE_TYPES.includes(field.type)) {
                        groupableFields[name] = field;
                    }
                }
            });
            measures.__count = { string: this.env._t("Count"), type: "integer" };


            this.arch.children.forEach(field => {
                let name = field.attributes.name;

                // Remove invisible fields from the measures
                if (field.attributes.invisible && py.eval(field.attributes.invisible)) {
                    delete measures[name];
                    return;
                }
                if (field.attributes.interval) {
                    name += ':' + field.attributes.interval;
                }
                if (field.attributes.widget) {
                    widgets[name] = field.attributes.widget;
                }
                // add active measures to the measure list.  This is very rarely
                // necessary, but it can be useful if one is working with a
                // functional field non stored, but in a model with an overrided
                // read_group method.  In this case, the pivot view could work, and
                // the measure should be allowed.  However, be careful if you define
                // a measure in your pivot view: non stored functional fields will
                // probably not work (their aggregate will always be 0).
                if (field.attributes.type === 'measure' && !(name in measures)) {
                    measures[name] = this.fields[name];
                }
                if (field.attributes.string && name in measures) {
                    measures[name].string = field.attributes.string;
                }
                if (field.attributes.type === 'measure' || 'operator' in field.attributes) {
                    activeMeasures.push(name);
                    measures[name] = this.fields[name];
                }
                if (field.attributes.type === 'col') {
                    colGroupBys.push(name);
                }
                if (field.attributes.type === 'row') {
                    rowGroupBys.push(name);
                }
            });
            if ((!activeMeasures.length) || this.arch.attributes.display_quantity) {
                activeMeasures.splice(0, 0, '__count');
            }

            this.loadParams.measures = activeMeasures;
            this.loadParams.colGroupBys = this.env.device.isMobile ? [] : colGroupBys;
            this.loadParams.rowGroupBys = rowGroupBys;
            this.loadParams.fields = this.fields;
            this.loadParams.default_order = params.default_order || this.arch.attributes.default_order;
            this.loadParams.groupableFields = groupableFields;

            const disableLinking = !!(this.arch.attributes.disable_linking &&
                                        JSON.stringify(this.arch.attributes.disable_linking));

            this.rendererParams.widgets = widgets;
            this.rendererParams.disableLinking = disableLinking;
            
            this.disableLinking = disableLinking;
            this.title = params.title || this.arch.attributes.string || this.env._t("Untitled");
            this.measures = measures;

            // retrieve form and list view ids from the action to open those views
            // when a data cell of the pivot view is clicked
            this.views = [
                _findView(params.actionViews, 'list'),
                _findView(params.actionViews, 'form'),
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
                type: type
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
    Object.assign(PivotViewController, {
        display_name: _lt("Pivot"),
        viewType: "pivot",
        icon: 'fa-table',
        searchMenuTypes: ['filter', 'groupBy', 'comparison', 'favorite'],
    });
    Object.assign(PivotViewController.components, {
        View: PivotRenderer,
        Model: PivotModel,
    });

    return PivotViewController;
});
