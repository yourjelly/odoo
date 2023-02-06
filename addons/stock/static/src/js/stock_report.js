odoo.define('stock.stock_report_new', function (require) {
"use strict";

var core = require('web.core');
var Context = require('web.Context');
var AbstractAction = require('web.AbstractAction');
var Dialog = require('web.Dialog');
var datepicker = require('web.datepicker');
var session = require('web.session');
var field_utils = require('web.field_utils');
var RelationalFields = require('web.relational_fields');
var StandaloneFieldManagerMixin = require('web.StandaloneFieldManagerMixin');
var { WarningDialog } = require("@web/legacy/js/_deprecated/crash_manager_warning_dialog");
var Widget = require('web.Widget');

var QWeb = core.qweb;
var _t = core._t;

var M2MFilters = Widget.extend(StandaloneFieldManagerMixin, {
    /**
     * @constructor
     * @param {Object} fields
     */
    init: function (parent, fields, change_event) {
        this._super.apply(this, arguments);
        StandaloneFieldManagerMixin.init.call(this);
        this.fields = fields;
        this.widgets = {};
        this.change_event = change_event;
    },
    /**
     * @override
     */
    willStart: function () {
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
    start: function () {
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
     * @override
     * @returns {Promise}
     */
    _confirmChange: function () {
        var self = this;
        var result = StandaloneFieldManagerMixin._confirmChange.apply(this, arguments);
        var data = {};
        _.each(this.fields, function (filter, fieldName) {
            data[fieldName] = self.widgets[fieldName].value.res_ids;
        });
        this.trigger_up(this.change_event, data);
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
    _makeM2MWidget: function (fieldInfo, fieldName) {
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

const StockVariationReport = AbstractAction.extend({
    hasControlPanel: true,

    custom_events: {
        'product_filter_changed': function(ev) {
             var self = this;
             self.report_options.product_ids = ev.data.product_ids;
             self.report_options.product_categories = ev.data.product_categories;
             return self.reload().then(function () {
                 self.$searchview_buttons.find('.stock_product_filter').click();
             });
        },
    },

    willStart: async function () {
        const reportsInfoPromise = this._rpc({
            model: 'stock.report.new',
            method: 'get_report_informations',
            args: [this.id, this.report_options],
        }).then(res => this.parse_report_informations(res));
        const parentPromise = this._super(...arguments);
        return Promise.all([reportsInfoPromise, parentPromise]);
    },
    parse_report_informations: function(values) {
        this.main_html = values.main_html;
        this.report_options = values.options;
        this.$searchview_buttons = $(values.searchview_html);
    },
    start: async function() {
        this.controlPanelProps.cp_content = {
            $searchview_buttons: this.$searchview_buttons,
        };
        await this._super(...arguments);
        this.render();
    },

    render: function() {
        this.render_template();
        this.render_searchview_buttons();
    },

    render_template: function() {
        this.$('.o_content').html(this.main_html);
    },

    // Updates the control panel and render the elements that have yet to be rendered
    update_cp: function() {
        var status = {
            cp_content: {
                $searchview_buttons: this.$searchview_buttons,
            },
        };
        return this.updateControlPanel(status);
    },

    reload: function() {
        var self = this;
        return this._rpc({
                model: 'stock.report.new',
                method: 'get_report_informations',
                args: [self.id, self.report_options],
                context: self.odoo_context,
            })
            .then(function(result){
                self.parse_report_informations(result);
                self.render();
                return self.update_cp();
            });
    },

    render_searchview_buttons: function() {
        var self = this;

        // fold all menu
        this.$searchview_buttons.find('.js_foldable_trigger').click(function (event) {
            $(this).toggleClass('o_closed_menu o_open_menu');
            self.$searchview_buttons.find('.o_foldable_menu[data-filter="'+$(this).data('filter')+'"]').toggleClass('o_closed_menu');
        });
        
        // product filter
        if (this.report_options.product) {
            if (!this.products_m2m_filter) {
                var fields = {};
                if ('product_ids' in this.report_options) {
                    fields['product_ids'] = {
                        label: _t('Products'),
                        modelName: 'product.product',
                        value: this.report_options.product_ids.map(Number),
                    };
                }
                if ('product_categories' in this.report_options) {
                    fields['product_categories'] = {
                        label: _t('Product Category'),
                        modelName: 'product.category',
                        value: this.report_options.product_categories.map(Number),
                    };
                }
                if (!_.isEmpty(fields)) {
                    this.products_m2m_filter = new M2MFilters(this, fields, 'product_filter_changed');
                    this.products_m2m_filter.appendTo(this.$searchview_buttons.find('.js_stock_product_m2m'));
                }
            } else {
                this.$searchview_buttons.find('.js_stock_product_m2m').append(this.products_m2m_filter.$el);
            }
        }

        // events

        // click events fore date
        this.$searchview_buttons.find('.js_stock_report_date_filter').click(function (event) {
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

        //click event for product
        this.$searchview_buttons.find('.js_stock_reports_one_choice_filter').click(function (event) {
            var warehouse_id = $(this).data('filter');
            self.report_options[warehouse_id] = $(this).data('warehouse_id');debugger
            self.reload();
        });
    },

});

core.action_registry.add('stock_report_new', StockVariationReport);
return(StockVariationReport);
});
