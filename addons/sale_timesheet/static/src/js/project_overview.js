odoo.define('sale_timesheet.project_overview', function (require) {
    "use strict";

    const datepicker = require('web.datepicker');
    const field_utils = require('web.field_utils');
    const WarningDialog = require('web.CrashManager').WarningDialog;
    const core = require('web.core');
    const AbstractAction = require('web.AbstractAction');
    const _t = core._t;
    const QWeb = core.qweb;
    const StandaloneFieldManagerMixin = require('web.StandaloneFieldManagerMixin');
    const Widget = require('web.Widget');
    const RelationalFields = require('web.relational_fields');
    const session = require('web.session');
    const M2MFilters = Widget.extend(StandaloneFieldManagerMixin, {
        /**
         * @constructor
         * @param {Object} fields
         */
        init(parent, fields) {
            this._super.apply(this, arguments);
            StandaloneFieldManagerMixin.init.call(this);
            this.fields = fields;
            this.widgets = {};
        },
        /**
         * @override
         */
        willStart() {
            var self = this;
            var defs = [this._super.apply(this, arguments)];
            _.each(this.fields, function (field, fieldName) {
                defs.push(self._makeM2MWidget(field, fieldName));
            });
            return Promise.all(defs);
        },
        /**
         * @override
         */
        start() {
            var self = this;
            var $content = $(QWeb.render("m2mWidgetTable", {fields: this.fields}));
            self.$el.append($content);
            _.each(this.fields, function (field, fieldName) {
                self.widgets[fieldName].appendTo($content.find('#'+fieldName+'_field'));
            });
            return this._super.apply(this, arguments);
        },

        //--------------------------------------------------------------------------
        // Private
        //--------------------------------------------------------------------------

        /**
         * This method will be called whenever a field value has changed and has
         * been confirmed by the model.
         *
         * @private
         * @returns {Promise}
         */
        _confirmChange() {
            const self = this;
            const result = StandaloneFieldManagerMixin._confirmChange.apply(this, arguments);
            let data = {};
            _.each(this.fields, (filter, fieldName) => {
                data[fieldName] = self.widgets[fieldName].value.res_ids;
            });
            self.trigger_up('value_changed', data);
            return result;
        },
        /**
         * This method will create a record and initialize M2M widget.
         *
         * @private
         * @param {Object} fieldInfo
         * @param {string} fieldName
         * @returns {Promise}
         */
        _makeM2MWidget(fieldInfo, fieldName) {
            var self = this;
            var options = {};
            options[fieldName] = {
                options: {
                    no_create_edit: true,
                    no_create: true,
                }
            };
            return this.model.makeRecord(fieldInfo.modelName, [{
                fields: [{
                    name: 'id',
                    type: 'integer',
                }, {
                    name: 'display_name',
                    type: 'char',
                }],
                name: fieldName,
                relation: fieldInfo.modelName,
                type: 'many2many',
                value: fieldInfo.value,
            }], options).then(function (recordID) {
                self.widgets[fieldName] = new RelationalFields.FieldMany2ManyTags(self,
                    fieldName,
                    self.model.get(recordID),
                    {mode: 'edit',}
                );
                self._registerWidget(recordID, fieldName, self.widgets[fieldName]);
            });
        },
    });

    const projectOverviewReport = AbstractAction.extend({
        hasControlPanel: true,

        events: {
            'click .project_overview_foldable': '_onFoldToggle',
            'click .o_search_options .dropdown-menu': '_onClickDropDownMenu',
            'click .o_report_action': '_onClickAction',
        },


        custom_events: {
            'value_changed'(ev) {
                this.data = ev.data;
                const self = this;
                if (ev.data.partner_ids) {
                    self.report_options.partner_ids = ev.data.partner_ids;
                } else if (ev.data.project_ids) {
                    self.report_options.project_ids = ev.data.project_ids;
                } else if (ev.data.manager_ids) {
                    self.report_options.manager_ids = ev.data.manager_ids;
                } else if (ev.data.employee_ids) {
                    self.report_options.employee_ids = ev.data.employee_ids;
                } else if (ev.data.so_item_ids) {
                    self.report_options.so_item_ids = ev.data.so_item_ids;
                } else if (ev.data.analytic_account_ids) {
                    self.report_options.analytic_account_ids = ev.data.analytic_account_ids;
                }
                return self.reload().then(()=> {
                    if (self.data.partner_ids) {
                        self.$searchview_buttons.find('.project_partner_filter').click();
                    }
                    else if (self.data.project_ids) {
                        self.$searchview_buttons.find('.project_favorite_filter').click();
                    }
                    else if (self.data.manager_ids) {
                        self.$searchview_buttons.find('.project_manager_filter').click();
                    }
                    else if (self.data.employee_ids) {
                        self.$searchview_buttons.find('.project_employee_filter').click();
                    }
                    else if (self.data.so_item_ids) {
                        self.$searchview_buttons.find('.project_so_item_filter').click();
                    }
                    else if (self.data.analytic_account_ids) {
                        self.$searchview_buttons.find('.project_analytic_filter').click();
                    }
                });
            },
        },

        init(parent, action) {
            this.report_model = action.context.model;
            if (this.report_model === undefined) {
                this.report_model = 'project.project';
            }
            this.project_report_id = false;
            if (action.context.id) {
                this.project_report_id = action.id;
            }
            this.odoo_context = action.context;
            this.report_options = action.params && action.params.options;
            this.ignore_session = action.params && action.params.ignore_session;
            if ((this.ignore_session === 'read' || this.ignore_session === 'both') !== true) {
                const persist_key = 'report:'+this.report_model+':'+this.project_report_id+':'+session.company_id;
                this.report_options = JSON.parse(sessionStorage.getItem(persist_key))
            }
            return this._super(...arguments);
        },
        willStart: async function () {
            const reportsInfoPromise = this._rpc({
                model: this.report_model,
                method: 'get_search_template',
                args: [this.report_options],
            }).then(res => this.parse_reports_informations(res));
            const parentPromise = this._super(...arguments);
            return Promise.all([reportsInfoPromise, parentPromise]);
        },

        parse_reports_informations(values) {
            this.$searchview_buttons = $(values.searchview_html);
            this.$main_view = values.main_html;
            this.report_options = values.options;
            this.persist_options();
        },

        persist_options() {
            if ((this.ignore_session === 'read' || this.ignore_session === 'both') !== true) {
                const persist_key = 'report:'+this.report_model+':'+this.project_report_id+':'+session.company_id;
                sessionStorage.setItem(persist_key, JSON.stringify(this.report_options));
            }
        },

        async start() {
            this.controlPanelProps.cp_content = {
                $searchview_buttons: this.$searchview_buttons,
            };
            await this._super(...arguments);
            this.render();
        },

        render() {
            this.el.querySelector('.o_content').innerHTML = this.$main_view
            this.render_searchview_buttons();

        },

        // Updates the control panel and render the elements that have yet to be rendered
        update_cp() {
            const status = {
                cp_content: {$searchview_buttons: this.$searchview_buttons},
            };
            return this.updateControlPanel(status);
        },

        async reload() {
            const self = this;
            await this._rpc({
                model: 'project.project',
                method: 'get_search_template',
                args: [self.report_options],
                context: self.odoo_context,
            }).then((result) => {
                self.parse_reports_informations(result);
                self.render();
                return self.update_cp();
            });
        },

        render_searchview_buttons() {
            const self = this;
            const $datetimepickers = this.$searchview_buttons.find('.js_account_reports_datetimepicker');
            const options = { // Set the options for the datetimepickers
                locale : moment.locale(),
                format : 'L',
                icons: {
                    date: "fa fa-calendar",
                },
            };
            // attach datepicker
            $datetimepickers.each(function() {
                var name = $(this).find('input').attr('name');
                var defaultValue = $(this).data('default-value');
                $(this).datetimepicker(options);
                var dt = new datepicker.DateWidget(options);
                dt.replace($(this)).then(function () {
                    dt.$el.find('input').attr('name', name);
                    if (defaultValue) { // Set its default value if there is one
                        dt.setValue(moment(defaultValue));
                    }
                });
            });

            // format date that needs to be show in user lang
            _.each(this.$searchview_buttons.find('.js_format_date'),(dt)=> {
                var date_value = $(dt).html();
                $(dt).html((new moment(date_value)).format('ll'));
            });
            this.$searchview_buttons.find('.js_project_report_date_filter').click(function (event) {
                self.report_options.date.filter = $(this).data('filter');

                var error = false;
                if ($(this).data('filter') === 'custom') {
                    var date_from = self.$searchview_buttons.find('.o_datepicker_input[name="date_from"]');
                    var date_to = self.$searchview_buttons.find('.o_datepicker_input[name="date_to"]');
                    if (date_from.length > 0){
                        error = date_from.val() === "" || date_to.val() === "";
                        self.report_options.date.date_from = field_utils.parse.date(date_from.val());
                        self.report_options.date.date_to = field_utils.parse.date(date_to.val());
                    }
                    else {
                        error = date_to.val() === "";
                        self.report_options.date = null;
                        self.report_options.date.date_to = field_utils.parse.date(date_to.val());
                    }
                }
                if (error) {
                    new WarningDialog(self, {
                        title: _t("Odoo Warning"),
                    }, {
                        message: _t("Date cannot be empty")
                    }).open();
                } else {
                    self.reload();
                }
            });

            if (this.report_options.partner_ids) {
                if (!this.M2MPartnerFilters) {
                    var fields = {};
                    if ('partner_ids' in this.report_options) {
                        fields['partner_ids'] = {
                            label: _t('Customers'),
                            modelName: 'res.partner',
                            value: this.report_options.partner_ids.map(Number),
                        };
                    }
                    if (!_.isEmpty(fields)) {
                        this.M2MPartnerFilters = new M2MFilters(this, fields);
                        this.M2MPartnerFilters.appendTo(this.$searchview_buttons.find('.js_project_customer_m2m'));
                    }
                } else {
                    this.$searchview_buttons.find('.js_project_customer_m2m').append(this.M2MPartnerFilters.$el);
                }
            }

            if (this.report_options.project_ids) {
                if (!this.M2MProjFilters) {
                    var fields = {};
                    if ('project_ids' in this.report_options) {
                        fields['project_ids'] = {
                            label: _t('Projects'),
                            modelName: 'project.project',
                            value: this.report_options.project_ids.map(Number),
                        };
                    }
                    if (!_.isEmpty(fields)) {
                        this.M2MProjFilters = new M2MFilters(this, fields);
                        this.M2MProjFilters.appendTo(this.$searchview_buttons.find('.js_projects_m2m'));
                    }
                } else {
                    this.$searchview_buttons.find('.js_projects_m2m').append(this.M2MProjFilters.$el);
                }
            }

            if (this.report_options.manager_ids) {
                if (!this.M2MProMgrFilters) {
                    var fields = {};
                    if ('manager_ids' in this.report_options) {
                        fields['manager_ids'] = {
                            label: _t('Project Managers'),
                            modelName: 'res.users',
                            value: this.report_options.manager_ids.map(Number),
                        };
                    }
                    if (!_.isEmpty(fields)) {
                        this.M2MProMgrFilters = new M2MFilters(this, fields);
                        this.M2MProMgrFilters.appendTo(this.$searchview_buttons.find('.js_project_manager_m2m'));
                    }
                } else {
                    this.$searchview_buttons.find('.js_project_manager_m2m').append(this.M2MProMgrFilters.$el);
                }
            }
            if (this.report_options.employee_ids) {
                if (!this.M2MProEmpFilters) {
                    var fields = {};
                    if ('employee_ids' in this.report_options) {
                        fields['employee_ids'] = {
                            label: _t('Project Employees'),
                            modelName: 'hr.employee',
                            value: this.report_options.employee_ids.map(Number),
                        };
                    }
                    if (!_.isEmpty(fields)) {
                        this.M2MProEmpFilters = new M2MFilters(this, fields);
                        this.M2MProEmpFilters.appendTo(this.$searchview_buttons.find('.js_project_employee_m2m'));
                    }
                } else {
                    this.$searchview_buttons.find('.js_project_employee_m2m').append(this.M2MProEmpFilters.$el);
                }
            }
            if (this.report_options.so_item_ids) {
                if (!this.M2MSOItemFilters) {
                    var fields = {};
                    if ('so_item_ids' in this.report_options) {
                        fields['so_item_ids'] = {
                            label: _t('Sales Order Items'),
                            modelName: 'sale.order.line',
                            value: this.report_options.so_item_ids.map(Number),
                        };
                    }
                    if (!_.isEmpty(fields)) {
                        this.M2MSOItemFilters = new M2MFilters(this, fields);
                        this.M2MSOItemFilters.appendTo(this.$searchview_buttons.find('.js_project_so_item_m2m'));
                    }
                } else {
                    this.$searchview_buttons.find('.js_project_so_item_m2m').append(this.M2MSOItemFilters.$el);
                }
            }
            if (this.report_options.analytic_account_ids) {
                if (!this.M2MAnalyticAcctFilters) {
                    var fields = {};
                    if ('analytic_account_ids' in this.report_options) {
                        fields['analytic_account_ids'] = {
                            label: _t('Analytic Account'),
                            modelName: 'account.analytic.account',
                            value: this.report_options.analytic_account_ids.map(Number),
                        };
                    }
                    if (!_.isEmpty(fields)) {
                        this.M2MAnalyticAcctFilters = new M2MFilters(this, fields);
                        this.M2MAnalyticAcctFilters.appendTo(this.$searchview_buttons.find('.js_project_analytic_m2m'));
                    }
                } else {
                    this.$searchview_buttons.find('.js_project_analytic_m2m').append(this.M2MAnalyticAcctFilters.$el);
                }
            }

            this.$searchview_buttons.find('.js_foldable_trigger').click(function (event) {
                $(this).toggleClass('o_closed_menu o_open_menu');
                self.$searchview_buttons.find('.o_foldable_menu[data-filter="'+$(this).data('filter')+'"]').toggleClass('o_closed_menu');
            });
        },

        _updateControlPanelProps() {
            this._super.apply(this, arguments);
            this.controlPanelProps.cp_content.$searchview_buttons = this.$searchview_buttons;
        },

        _onFoldToggle(ev) {
            const {model, resId} = ev.target.dataset;
            const shouldOpen = ev.target.classList.contains('fa-caret-right');
            if (model === 'sale.order' && shouldOpen) {
                this._openSaleOrder(resId);
            }
            else if (model === 'sale.order.line' && shouldOpen) {
                this._openSaleOrderLine(resId);
            }
            else {
                const targetClass = `.${model.replace(/\./g, '_')}_${resId || 'None'}`;
                this.$(targetClass).hide();
            }
            $(ev.target).toggleClass('fa-caret-right');
            $(ev.target).toggleClass('fa-caret-down');
        },

        _openSaleOrder(id) {
            id = id || 'None';
            const targetClass = `.sale_order_${id}`;
            this.$(`.o_timesheet_forecast_sale_order_line${targetClass}`).show();
            this.$(`.o_timesheet_forecast_hr_employee${targetClass}`).hide();
            this.$(`.o_timesheet_forecast_sale_order_line${targetClass} .fa`).removeClass('fa-caret-down');
            this.$(`.o_timesheet_forecast_sale_order_line${targetClass} .fa`).addClass('fa-caret-right');

        },

        _openSaleOrderLine(id) {
            id = id || 'None';
            const targetClass = `.sale_order_line_${id}`;
            this.$(`.o_timesheet_forecast_hr_employee${targetClass}`).show();
        },

        //-------------------------------------------------------------------------
        // Handlers
        //-------------------------------------------------------------------------
        _onClickAction (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            const data = ev.currentTarget.dataset;
            if (data.resId) {
                const resId = parseInt(data.resId);
                return this.do_action({
                    type: 'ir.actions.act_window',
                    res_model: data.model,
                    res_id: resId,
                    context: {
                        'active_id': resId
                    },
                    views: [[false, 'form']],
                    target: 'current'
                });
            }
            const title = data.name || ev.currentTarget.text;
            const domain = data.domain ? JSON.parse(data.domain) : null;
            const context = data.context ? JSON.parse(data.context) : null;
            return this.do_action({
                name: _t(title),
                type: 'ir.actions.act_window',
                res_model: data.model,
                domain: domain,
                context: context,
                views: data.views ? JSON.parse(data.views): [[false, 'list']],
                target: 'current'
            });
        },
        /**
         * When clicking inside a dropdown to modify search options
         * prevents the bootstrap dropdown to close on itself
         *
         * @private
         * @param {$.Event} ev
         */
        _onClickDropDownMenu(ev) {
            ev.stopPropagation();
        },
    });

    core.action_registry.add('project_overview', projectOverviewReport);

    return projectOverviewReport;
});
