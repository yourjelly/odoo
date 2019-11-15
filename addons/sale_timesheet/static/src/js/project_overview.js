odoo.define('sale_timesheet.project_overview', function (require) {
    "use strict";

    var core = require('web.core');
    var qweb = require('web.qweb');
    var viewRegistry = require('web.view_registry');
    var StandaloneFieldManagerMixin = require('web.StandaloneFieldManagerMixin');
    var Widget = require('web.Widget');
    var RelationalFields = require('web.relational_fields');

    var _t = core._t;

    const Controller = qweb.Controller.extend({

        filterButtons: undefined,

        async start() {
            await this._super.apply(this, arguments);
            this.filterButtons = new ProjectOverviewFilters(this)
            await this.filterButtons.appendTo(this._controlPanel.renderer.nodes.$searchview_buttons);
        },

        async update() {
            await this._super.apply(this, arguments);
            this._controlPanel.updateContents({
                cp_content: {
                    $searchview_buttons: this.filterButtons.$el,
                },
            })
        },
    });

    class Preset {

        constructor({title, value}) {
            this.domId = _.uniqueId('project_overview_preset');
            this.title = title;
            this._getValue = value;
            this._currentValue = undefined;
        }

        async getValue() {
            const value = await this._getValue();
            this._currentValue = value;
            return value;
        }

        is(value) {
            if (this._currentValue === undefined) {
                return undefined // undefined as "I don't know"
            }
            return _.isEqual(value.sort(), this._currentValue.sort());
        }
    }

    const MyMany2manyFilter = Widget.extend(StandaloneFieldManagerMixin, {
        template: 'sale_timesheet.ProjectOverviewMenu',
        events: {
            // 'click .o_dropdown_toggler_btn': '_onDropdownToggle',
            'click .o_poject_filter_preset': '_onPresetClicked',
        },

        init(parent, {modelName, fieldName, title, icon='fa-filter', initalValue=[], presets=[]}) {
            this._super(parent);
            StandaloneFieldManagerMixin.init.call(this);
            this.modelName = modelName;
            this.fieldName = fieldName;
            this.title = title;
            this.icon = icon;
            this.value = initalValue;
            this.presets = presets
            this.fieldWidget = undefined;
        },

        async start() {
            await this._super.apply(this, arguments);
            return this._attachM2MTags()
        },

        async _attachM2MTags() {
            if (this.fieldWidget) {
                this.fieldWidget.destroy()
            }
            const record = await this._makeRecord(this.value)
            this.fieldWidget = new RelationalFields.FieldMany2ManyTags(this,
                this.fieldName,
                record,
                {mode: 'edit'},
            );
            this._registerWidget(record.id, this.fieldName, this.fieldWidget);
            return this.fieldWidget.appendTo(this.$('.o_project_overview_filter'))
        },

        _setSelectedPresets() {
            this.presets.forEach(p => {
                this.$(`#${p.domId}`).toggleClass('selected', p.is(this.value))
            });
        },

        async _makeRecord(value) {
            let options = {};
            options[this.fieldName] = {
                options: {
                    no_create_edit: true,
                    no_create: true,
                },
            };
            const recordId = await this.model.makeRecord('project.project', [{
                fields: [{
                    name: 'display_name',
                    type: 'char',
                }],
                name: this.fieldName,
                relation: this.modelName,
                type: 'many2many',
                value,
            }], options);
            return this.model.get(recordId);
        },

        /**
         * @override
         */
        async _onFieldChanged(event) {
            await StandaloneFieldManagerMixin._onFieldChanged.apply(this, arguments);
            const state = this.model.get(event.data.dataPointID);
            const ids = state.data[this.fieldName].res_ids;
            this.value = ids;
            this._setSelectedPresets();
            this.trigger_up('domain_changed', {
                field: this.fieldName,
                domain: [['id', 'in', ids]],
            });
        },

        async _onPresetClicked(event) {
            event.preventDefault();
            event.stopPropagation();
            const presetId = event.currentTarget.id;
            const preset = this.presets.find(p => p.domId === presetId);
            const value = await preset.getValue();
            if (value.length) {
                this.value = value;
                this._attachM2MTags();
                this._setSelectedPresets();
            }
        },
    })

    const ProjectOverviewFilters = Widget.extend({
        custom_events: {
            'domain_changed': '_onDomainChanged',
        },
        domains: {},

        _getFavoriteProjects() {
            const domain = [['favorite_user_ids', 'in', [this.getSession().uid]]]
            return this._rpc({
                model: 'project.project',
                method: 'search',
                args: [domain],
            })
        },

        async start() {
            await this._super.apply(this, arguments);
            const partners = new MyMany2manyFilter(this, {
                modelName: 'res.partner',
                fieldName: 'task_partner_ids',
                title: _t("Customers"),
                icon: 'fa-users',
            });
            const users = new MyMany2manyFilter(this, {
                modelName: 'res.users',
                fieldName: 'task_user_ids',
                title: _t("Employees"),
                icon: 'fa-users',
            });
            const projects = new MyMany2manyFilter(this, {
                modelName: 'project.project',
                fieldName: 'id',
                title: _t("Projects"),
                icon: 'fa-puzzle-piece',
                presets: [new Preset({
                    title: _t("My Favorites"),
                    value: () => this._getFavoriteProjects(),
                })],
            });
            const managers = new MyMany2manyFilter(this, {
                modelName: 'res.users',
                fieldName: 'user_id',
                title: _t("Project Manager"),
                icon: 'fa-users',
            });
            const analyticAccounts = new MyMany2manyFilter(this, {
                modelName: 'account.analytic.account',
                fieldName: 'analytic_account_id',
                title: _t("Analytic Accounts"),
                icon: 'fa-folder-open',
            });
            return Promise.all([
                projects.appendTo(this.el),
                partners.appendTo(this.el),
                managers.appendTo(this.el),
                users.appendTo(this.el),
                analyticAccounts.appendTo(this.el),
            ]);
        },

        _onDomainChanged(event) {
            event.stopPropagation();
            this.domains[event.data.field] = event.data.domain;
            this.trigger_up('render_params_changed', this.domains);
        },

    })

    /**
     * view
     */
    var ProjectOverview = qweb.View.extend({
        mobile_friendly: false,  // TODO check mobile responsivness
        withSearchBar: false,
        searchMenuTypes: [],

        config: _.extend({}, qweb.View.prototype.config, {
            Controller: Controller,
        }),
    });

    viewRegistry.add('project_overview', ProjectOverview);
});
