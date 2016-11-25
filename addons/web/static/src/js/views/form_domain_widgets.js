odoo.define('web.form_domain_widgets', function (require) {
'use strict';

var core = require('web.core');
var common = require('web.form_common');
var Dialog = require('web.Dialog');
var datepicker = require('web.datepicker');
var Model = require('web.DataModel');
var pyeval = require('web.pyeval');
var session = require('web.session');
var Widget = require('web.Widget');

var _t = core._t;
var QWeb = core.qweb;
var SelectorCommon = common.AbstractField.extend(common.ReinitializeFieldMixin);

/**
 * 'child_of','parent_of','like','not like','=like','=ilike'
 * these operators used only if user entered manually or from demo data
 *
 */
var operator_mapping = {
    '=': _t('is equal to'),
    '!=': _t('is not equal to'),
    '>': _t('greater than'),
    '<': _t('less than'),
    '>=': _t('greater than or equal to'),
    '<=': _t('less than or equal to'),
    'ilike': _t('contains'),
    'not ilike': _t('not contains'),
    '∃': _t('is set'),
    '∄': _t('is not set'),
    'in': _t('in'),
    'not in': _t('not in'),
    'child_of': _t('child of'),
    'parent_of': _t('parent of'),
    'like': 'like',
    'not like': 'not like',
    '=like': '=like',
    '=ilike': '=ilike'
};

/**
 * Domain Selector Widget
 *
 * This widget used for building prefix char domain
 *
 * Known Issues:
 *    - It can maintain only single level priority (not a nested ones)
 *    - User can add/change nested priority domains from debug input but if user change
 *      such nested domain from ui instead of debug input it change original priority
 *    - Can not insert '!' operator
 *    - Some operators like 'child_of','parent_of','like','not like','=like','=ilike'
 *      will come only if you use them from demo data or debug input
 *    - Some kind of domain can not be build right now e.g ('country_id', 'in', [1,2,3,4])
 *      but you can insert from debug input
 *
 *    MEAN WHILE YOU CAN INSERT/UPDATE/DISPLAY ALL TYPES OF DOMAIN FROM DEBUG INPUT (just can't build/edit it from ui)
 *
 * Widget Options:
 *    - @param {string} logical_priority: can be field name or string '&' or '|'
 *    - @param {string} model: can be field name or string like 'res.partner'
 *    - @param {boolean} show_count: to display number of records
 *    - @param {boolean} show_selection: to display selected records in dialog
 *    - @param {boolean} validator: to enable and disable domain validator
 *    - @param {object} fs_filters: filter for field selector
 */
var FieldDomainSelector = SelectorCommon.extend({
    template: 'FieldDomain',
    events: {
        'change .o_debug_input': 'change_debug_input',
        'click .o_ds_logical_operator.o_ds_add': 'on_click_add_node',
        'click .o_ds_edit_node': 'on_click_edit_node',
        'click .o_ds_delete_node': 'on_click_delete_node',
        'click .o_ds_selection': 'on_click_show_selection'
    },
    willStart: function() {
        this.domain = [];
        this.infix_domain = [];
        this.valid = true;
        this.debug = session.debug;
        this.operator_mapping = operator_mapping;
        this.options = _.defaults(this.options || {}, {
            fs_filters: {},
            logical_priority: '&',
            model: 'res.partner',
            show_count: true,
            show_selection: true,
            validator: true
        });
        return this._super.apply(this, arguments);
    },
    start: function() {
        var self = this;
        /**
         * TO-DO: fix 'view_content_has_changed' and 'change:value' (sometime with pager 'render_value' called 2 times)
         * Issue: currently in when make change from pager, default render_value called when field value changes
         *        it doesn't depends on other fields so model and logical_priority gets wrong values from previous record
         *        though it get right values if dependent fields placed before domain field in form definition (that's why previous char_domain works)
         */
        this.field_manager.on('view_content_has_changed', this, function() {
            var present_model = self.model;
            var present_priority = self.logical_priority;
            self.set_logical_priority();
            self.set_ref_model();
            if (present_model != self.model || present_priority != self.logical_priority) {
                self.render_value();
            }

        });
        // need to re-compute and set domain according to priority changed by user
        if (this.field_manager.fields.hasOwnProperty(this.options.logical_priority)) {
            var field = this.field_manager.fields[this.options.logical_priority];
            field.on('change:value', this, function() {
                if (field._dirty_flag) {
                    self.view.onchanges_mutex.def.then(function() {
                        self.sync_value(true);
                    });
                }
            });
        }
        this.set_logical_priority();
        this.set_ref_model();
        return this._super.apply(this, arguments);
    },
    set_ref_model: function() {
        // Set model name from field options if option value is field then it set value from given field else raw value
        var model = this.options.model;
        if (!model) {
            this.do_warn(_t('Error: Model Not Set'), _t('Set model option from field definition'));
            return false;
        }
        this.model = this.field_manager.fields.hasOwnProperty(model) ? this.field_manager.get_field_value(model) : model;
    },
    set_logical_priority: function() {
        // Set logical_priority from field options if option value is field then it set value from given field else raw value
        var logical_priority = this.options.logical_priority;
        if (this.field_manager.fields.hasOwnProperty(logical_priority)) {
            logical_priority = this.field_manager.get_field_value(logical_priority);
        }
        if (!_.contains(['&', '|'], logical_priority)) {
            logical_priority == '&';
        }
        this.logical_priority = logical_priority;
        this.logical_alternative = logical_priority == '|' ? '&' : '|';
    },
    sync_value: function(reverse) {
        /**
         * sync_value used for sync values prefix to infix and vice versa
         *     @param {boolean} reverse: if true convert and set infix to prefix
         *                               if false convert and set prefix to infix
         */
        if (reverse) {
            this.domain = this.prefix_value();
            this.set_value(this.domain);
        } else {
            this.domain = pyeval.eval('domain', this.get('value') || []);
            this.infix_domain = this.infix_value();
        }
    },
    infix_value: function() {
        // Take prefix domain from field value and return infix value
        var prefix_domain = this.domain;
        if (prefix_domain.length <= 1) {
            return prefix_domain || [];
        }
        // Fill extra conditions
        var domains = 0;
        var operators = 0;
        var dict_domain = [];
        _.each(prefix_domain, function(node) {
            if (_.isArray(node)) {
                dict_domain.push({'domain': node});
                domains += 1;
            } else if (_.contains(['|', '&'], node)) {
                dict_domain.push(node);
                operators += 1;
            }
        });
        if (domains != 1 && operators + 1 < domains) {
            var extra_and = Array(domains - (operators + 1)).fill('&');
            dict_domain = extra_and.concat(dict_domain);
        }
        function process_domain() {
            var result = [];
            var operator = false;
            var domain_node = false;
            _.each(dict_domain, function(node) {
                if (_.contains(['|', '&'], node)) {
                    if (operator) {
                        result.push(operator);
                    }
                    if (domain_node) {
                        result.push(domain_node);
                    }
                    operator = node;
                    domain_node = false;
                } else {
                    if (domain_node && operator) {
                        result.push([domain_node, operator, node]);
                        operator = false;
                        domain_node = false;
                    } else if (domain_node) {
                        result.push(domain_node);
                        result.push(node);
                        domain_node = false;
                    } else if (operator) {
                        domain_node = node;
                    } else {
                        result.push(node);
                    }
                }
            });
            dict_domain = result;
            if (dict_domain.length > 1) {
                process_domain();
            }
        }
        process_domain();
        var infix_domain = [];
        // In future if we want to manage nested priority remove flatten and object conversion
        dict_domain = _.flatten(dict_domain);
        _.each(dict_domain, function(node) {
            infix_domain.push(_.isObject(node) ? node.domain : node);
        });
        return infix_domain;
    },
    prefix_value: function(){
        // Take infix domain from infix_value and return prefix value
        var self = this;
        var priority = [];
        var alternative = [];
        _.each(this.infix_domain, function(node) {
            if (_.isString(node)) {
                if (self.logical_priority != node) {
                    alternative.push(priority);
                    priority = [];
                }
            } else {
                priority.push(node);
            }
        });
        if (priority.length > 0) {
            alternative.push(priority);
            priority = [];
        }
        var domain = Array((alternative.length || 1) - 1).fill(this.logical_alternative);
        _.each(alternative, function(nodes) {
            var extra = Array((nodes.length || 1) - 1).fill(self.logical_priority);
            extra = extra.concat(nodes);
            domain = domain.concat(extra);
        });
        return domain;
    },
    render_value: function() {
        this.sync_value();
        this.$('.o_ds_container')
            .replaceWith($(QWeb.render('FieldDomain.pills', {'widget': this, 'domain': this.infix_domain})));
        if (session.debug) {
            this.$('.o_debug_input').val(JSON.stringify(this.domain));
        }
        this.set_count();
        this._super();
    },
    on_click_add_node: function(event) {
        var index = $(event.currentTarget).data('index');
        this.open_filter_dialog('add', index);
    },
    on_click_edit_node: function(event) {
        var index = $(event.currentTarget).data('index');
        this.open_filter_dialog('edit', index);
    },
    on_click_delete_node: function(event) {
        var index = $(event.currentTarget).data('index');
        var domain = this.infix_domain;
        if (index == 0) {
            domain = _.rest(domain, 2);
        } else if (index == domain.length) {
            domain = _.initial(domain, 2);
        } else {
            var index_2;
            if (domain[index + 1] == this.logical_priority) {
                index_2 = index + 1;
            } else {
                index_2 = index - 1;
            }
            domain = _.filter(domain, function(e, i) { return (i != index) && (i != index_2); });
        }
        this.infix_domain = domain;
        this.sync_value(true);
    },
    open_filter_dialog: function(mode, index) {
        var self = this;
        if (!this.model) {
            this.do_warn(_t('Please Select Model'));
            return;
        }
        var node = this.infix_domain[index];
        var domain_editor = new DomainSelectorEditor(this.model, node, this.options.fs_filters);
        var dialog = new Dialog(this, {
             title: _.str.sprintf('%s %s', mode == 'add' ? _t('Add New') : _t('Edit'), _t('Filter')),
             size: 'medium',
             buttons: [
                 {text: _t('Save'), click: function() {
                    var domain = domain_editor.get_domain_value();
                    if (!domain[0]) {
                        self.do_warn(_t('Error'), _t('Please fill valid field and value'));
                    } else {
                        self.change_domain(domain, index, mode);
                        dialog.close();
                    }
                 }, classes: 'btn-primary'},
                 {text: _t('Discard'), close: true}
            ]
         });
        dialog.open();
        // added o_form_view because we use field selector widget of form view
        $(dialog.$el).addClass('o_ds_dialog o_form_view');
        domain_editor.appendTo(dialog.$el);
    },
    change_domain: function(domain, index, mode) {
        if (mode == 'add') {
            this.insert_value(domain, index);
        } else {
            this.change_value(domain, index);
        }
    },
    insert_value: function(domain, index) {
        if (_.isString(index)) {
            this.infix_domain.push(index);
            this.infix_domain.push(domain);
        } else {
            this.infix_domain.splice(index, 0, this.logical_priority, domain);
        }
        this.sync_value(true);
    },
    change_value: function(domain, index) {
        this.infix_domain[index] = domain;
        this.sync_value(true);
    },
    change_debug_input: function(event) {
        try {
            var val = $(event.target).val() || '[]' ;
            val = JSON.parse(val);
            this.set_value(val);
        } catch (err) {
            this.invalidate();
            this.do_warn(_t('Broken domain'), _t('please enter valid domain'));
        }
    },
    invalidate: function() {
        this.valid = false;
    },
    validate: function() {
        this.valid = true;
    },
    set_count: function() {
        var self = this;
        if (this.model && (this.options.count || this.options.validator)) {
            var model = new Model(this.model);
            var def = model.call('safe_search_count', [this.domain || []], {'context': this.build_context()}).then(function(data) {
                if(self.options.validator) {
                    if (data !== false) {
                        self.validate();
                    } else {
                        self.invalidate();
                    }
                    self.$('.o_ds_validator').toggleClass('hidden', data !== false);
                    self.$('.o_ds_selection').toggleClass('hidden', data == false);
                }
                if (self.options.show_count) {
                    self.$('.o_ds_count').text(data || 0);
                }
            });
        }
    },
    on_click_show_selection: function() {
        new common.SelectCreateDialog(this, {
            title: _t('Selected records'),
            res_model: this.model,
            domain: this.get('value'),
            no_create: true,
            readonly: true,
            disable_multiple_selection: true
        }).open();
    },
    is_syntax_valid: function() {
        if (this.field_manager.get('actual_mode') == 'view') {
            return true;
        }
        return this.valid;
    }
});

// Used build/edit domain
var DomainSelectorEditor = Widget.extend({
    template: 'FieldDomain.editor',
    events: {
        'field_chain_changed': 'on_field_chain_changed',
        'change .o_ds_field_operator': 'on_field_operator_changed',
        'click .o_ds_add_tag': 'on_add_tag',
        'click .o_ds_remove_tag': 'on_remove_tag',
        'keyup .o_ds_tags input': 'on_add_tag'
    },
    init: function(model, domain, fs_filters) {
        if (!_.isArray(domain)) {
            domain = false;
        }
        this.model = model;
        this.fs_filters = fs_filters || {};
        this.chain = domain && domain[0] || '';
        this.operator = domain && domain[1] || '';
        this.value = domain && domain[2] || '';
        if (domain && domain[2] == false) {
            this.value = false;
        }
        this.selected_field = false;
        this.init = true;
    },
    start: function() {
        this.field_selector = new FieldSelectorWidget(this.model, this.chain, this.fs_filters);
        return this.field_selector.appendTo(this.$('.o_field_selector_container'));
    },
    set_selected_field: function() {
        this.selected_field = this.field_selector.selected_field;
    },
    on_field_chain_changed: function(event, change_type) {
        var operators = {};
        this.set_selected_field();
        switch (this.selected_field.type) {
            case 'boolean':
                operators = {'=': 'is'};
                break;
            case 'char':
            case 'text':
                operators = _.pick(operator_mapping, '=', '!=', 'ilike', 'not ilike', '∃', '∄', 'in', 'not in');
                break;
            case 'many2many':
            case 'one2many':
            case 'many2one':
            case 'html':
                operators = _.pick(operator_mapping, '=', '!=', 'ilike', 'not ilike', '∃', '∄');
                break;
            case 'integer':
            case 'float':
            case 'monetary':
                operators = _.pick(operator_mapping, '=', '!=', '>', '<', '>=', '<=', 'ilike', 'not ilike', '∃', '∄', 'in', 'not in');
                break;
            case 'selection':
                operators = _.pick(operator_mapping, '=', '!=', '∃', '∄','in', 'not in');
                break;
            case 'date':
            case 'datetime':
                operators = _.pick(operator_mapping, '=', '!=', '>', '<', '>=', '<=', '∃', '∄');
                break;
        }
        if (this.init || change_type == 'selected') {
            this.replace_operators(operators);
            this.replace_value();
        }
        if (this.init) {
            this.init_value();
            this.init = false;
        }
        this.on_field_operator_changed();
    },
    replace_operators: function(operators) {
        this.$('.o_ds_field_operator').replaceWith(QWeb.render('FieldDomain.editor.operators', {'operators':operators}));
    },
    replace_value: function() {
        var selection = [];
        var type = this.selected_field.type;
        if (type == 'boolean') {
            selection = [['true', 'set (true)'], ['false', 'not set (false)']];
        } else if (type == 'selection') {
            selection = this.selected_field.selection;
        }
        var $value_cell = this.$el.find('td.o_ds_value_cell');
        $value_cell.children().remove(); // remove old values
        if (type == 'datetime') {
            this.picker = new datepicker.DateTimeWidget(this.$el);
            this.picker.appendTo($value_cell);
        } else if (type == 'date') {
            this.picker = new datepicker.DateWidget(this.$el);
            this.picker.appendTo($value_cell);
        } else {
            $value_cell.append(QWeb.render('FieldDomain.editor.value', {'selection': selection, 'widget': this}));
        }
    },
    init_value: function() {
        if (this.selected_field.type == 'boolean') {
            this.$('.o_ds_field_value').val(this.value ? 'true' : 'false');
        } else if (this.operator == '!=' && this.value == false) {
            this.$('.o_ds_field_operator').val('∃');
            this.$('.o_ds_field_operator').change();
        } else if (this.operator == '=' && this.value == false) {
            this.$('.o_ds_field_operator').val('∄');
            this.$('.o_ds_field_operator').change();
        } else if (_.contains(['date', 'datetime'], this.selected_field.type)) {
            this.$('.o_ds_field_operator').val(this.operator);
            this.picker.set_value(this.value);
        } else {
            // In case user entered manually or from demo data
            if(_.contains(['child_of','parent_of','like','not like','=like','=ilike'], this.operator)){
                var el = _.str.sprintf('<option value="%s">%s</option>', this.operator ,operator_mapping[this.operator]);
                this.$('.o_ds_field_operator').append($(el));
            }
            this.$('.o_ds_field_operator').val(this.operator);
            this.$('.o_ds_field_value').val(this.value);
        }
    },
    on_field_operator_changed: function() {
        var old_val = this.operator;
        this.operator = this.$('.o_ds_field_operator').val();
        if (old_val != this.operator && (_.contains(['not in', 'in'], old_val) ^ _.contains(['not in', 'in'], this.operator))) {
            this.value = _.contains(['not in', 'in'], this.operator) ? [] : '';
            this.replace_value();
        }
        this.$('.o_ds_value_cell').toggleClass('hidden', _.contains(['∃', '∄'], this.operator));
    },
    on_add_tag: function(event) {
        if (event.type == 'keyup' && event.which != $.ui.keyCode.ENTER) {
            return;
        }
        var val = this.$('.o_ds_tags input,.o_ds_tags select').val().trim();
        if (val && _.contains(['not in', 'in'], this.operator)) {
            if(_.contains(['integer', 'float', 'monetary'], this.selected_field.type)){
                val = parseFloat(val) || 0;
            }
            if (_.isArray(this.value)) {
                if (this.value.indexOf(val) == -1) {
                    this.value.push(val);
                }
            } else {
                this.value = [val];
            }
            this.replace_value();
        }
        this.$('.o_ds_tags input').focus();
    },
    on_remove_tag: function(event) {
        var val = this.$(event.currentTarget).data('value');
        if (_.isArray(this.value)) {
            var index = this.value.indexOf(val);
            if (index > -1) {
                this.value.splice(index, 1);
            }
            this.replace_value();
        }
    },
    get_domain_value: function() {
        var field_chain = this.$('.o_fs_chain').val();
        var field_operator = this.$('.o_ds_field_operator').val();
        var field_value = this.$('.o_ds_field_value').val();
        if (!this.field_selector.valid) {
            return false;
        } else {
            var type = this.selected_field.type;
            if (field_operator == '∃') {
                field_operator = '!=';
                field_value =  false;
            } else if (field_operator == '∄') {
                field_operator = '=';
                field_value = false;
            } else if (type == 'boolean') {
                field_value = (field_value == 'true');
            }else if (_.contains(['in', 'not in'], field_operator)) {
                field_value = this.value || [];
            } else if (_.contains(['integer', 'float', 'monetary'], type)) {
                field_value = parseFloat(field_value) || 0;
            } else if (_.contains(['date', 'datetime'], type)) {
                field_value = this.picker.get_value();
            }
        }
        return [field_chain, field_operator, field_value];
    }
});


/**
 * Field Selector Common
 *
 * Field selector used to build field chain
 * It can be used as field widget(for form view) and normal widget(used in domain selector widget)
 *
 * FieldSelectorCommon is common methods used in both widget
 * FieldSelector is field widget can be used in form view
 * FieldSelectorWidget is normal widget
 */

var FieldSelectorCommon = {
    template: 'FieldSelector',
    events: {
        'click .o_open_fs': 'show_popover',
        'click .o_close_fs': 'hide_popover',
        'click .o_next_page': 'on_click_next_page',
        'click .o_prev_page': 'on_click_prev_page',
        'click li.o_select_field': 'on_click_dropdown_item',
        'change input': 'on_input_change',
        'mouseover li.o_field_item': 'on_hover_dropdown',
        'keydown': 'keydown_on_dropdown',
        'focusout .o_fs_popover': 'hide_popover'
    },
    init_common: function() {
        this.selected_field = false;
        this.is_selected = true;
        this.chain = '';
        this.debug = session.debug;
        this.pages = [];
        this.dirty = false;
    },
    set_chain: function(value) {
        this.chain = value;
        this.$('input').val(value);
    },
    get_chain: function() {
        return this.chain;
    },
    add_chain_node: function(field_name) {
        this.dirty = true;
        if (this.is_selected) {
            this.remove_chain_node();
            this.is_selected = false;
        }
        if (!this.valid) {
            this.set_chain('');
            this.validate();
        }
        var chain = this.get_chain();
        if (chain) {
            this.set_chain(chain + '.' + field_name);
        } else {
            this.set_chain(field_name);
        }
    },
    remove_chain_node: function() {
        if (this.pages.length > 1) {
            var chain = this.get_chain();
            this.set_chain(chain.substring(0, chain.lastIndexOf('.')));
        } else {
            this.set_chain('');
        }
    },
    invalidate: function() {
        this.$('.o_fs_warning').removeClass('hidden');
        this.valid = false;
    },
    validate: function() {
        this.$('.o_fs_warning').addClass('hidden');
        this.valid = true;
    },
    show_popover: function() {
        this.prefill();
        this.$('.o_fs_popover').show().focus();
    },
    hide_popover: function() {
        this.is_selected = true;
        this.$('.o_fs_popover').hide();
        if (this.dirty) {
            this.$el.trigger('field_chain_changed', 'selected');
        }
        this.dirty = false;
    },
    is_syntax_valid: function() {
        if (this.field_manager.get('actual_mode') == 'view') {
            return true;
        }
        return this.valid;
    },
    prefill: function() {
        var self = this;
        this.pages = [];
        this.push_page_data(this.model).then(function() {
            var chain = self.get_chain();
            if (chain) {
                // Reverse so we can use pop instead of shift
                self.prefill_queue = chain.split('.').reverse();
                return self.process_prefill_queue().then(function() {
                    self.display_page();
                });
            } else {
                self.display_page();
            }
        });
    },
    process_prefill_queue: function() {
        var self = this;
        var node = this.get_node_to_prefill();
        var def = $.Deferred()
        // Relational node (need to fetch related model) e.g. user_id.partner_id
        if (node && node.relation && this.prefill_queue.length > 0) {
            return this.push_page_data(node.relation).then(function() {
                return self.process_prefill_queue();
            });
        } else if (node && this.prefill_queue.length == 0) {
            this.selected_field = node;
            this.validate();
            this.$el.trigger('field_chain_changed', 'validated');
            def.resolve();
        } else {
            // Wrong node chain (probably user edited it manually) e.g name.active
            this.invalidate();
            def.resolve();
        }
        return def;
    },
    get_node_to_prefill:function() {
        return _.findWhere(_.last(this.pages).fields, {
            'name': this.prefill_queue.pop()
        });
    },
    push_page_data: function(model, animation) {
        var self = this;
        return fields_cache.get_fields(model, this.options.filters).then(function(data) {
            self.pages.push(data);
        });
    },
    display_page: function(animation) {
        var qs = $.deparam.querystring(); // In we want to enable debug for this if it is studio
        var is_studio = qs.studio || false;
        var page = _.last(this.pages);
        this.$('.o_prev_page').toggleClass('hidden', this.pages.length === 1);
        this.$('.o_fs_popover_header .o_fs_title').text(page.title);
        this.$('.o_fs_page').replaceWith(QWeb.render('FieldSelector.page', {'lines': page.fields, 'debug': session.debug || is_studio}));
        this.$('.o_fs_page').addClass(animation || '');
    },
    // Page Related Stuff
    on_click_next_page: function(event) {
        event.stopPropagation();
        var data = $(event.currentTarget).data();
        this.next_page(data.field_relation, data.name);
    },
    on_click_prev_page: function() {
        if (this.pages.length > 1) {
            this.pages.pop();
            this.display_page('o_animate_slide_left');
            this.remove_chain_node();
        }
    },
    on_click_dropdown_item: function(event) {
        var field_name = $(event.currentTarget).data('name');
        this.select_item(field_name);
    },
    select_item: function(field_name) {
        this.add_chain_node(field_name);
        this.selected_field = _.findWhere(_.last(this.pages).fields, {
            'name': field_name
        });
        this.hide_popover();
        this.$el.trigger('field_chain_changed', 'selected');
    },
    next_page: function(model, field_name) {
        var self = this;
        this.add_chain_node(field_name);
        this.selected_field = _.findWhere(_.last(this.pages).fields, {
            'name': field_name
        });
        this.push_page_data(model).then(function() {
            self.display_page('o_animate_slide_right');
        });
    },
    keydown_on_dropdown: function(event) {
        if (!this.$('.o_fs_popover').is(":visible")) {
            return;
        }
        switch(event.which) {
            case $.ui.keyCode.UP:
            case $.ui.keyCode.DOWN:
                event.preventDefault();
                this.navigation_dropdown(event.which);
                break;
            case $.ui.keyCode.RIGHT:
                event.preventDefault();
                var data = this.$('li.o_field_item.active').data();
                if (data && data.field_relation && data.name) {
                    this.next_page(data.field_relation, data.name);
                }
                break;
            case $.ui.keyCode.LEFT:
                event.preventDefault();
                this.on_click_prev_page();
                break;
            case $.ui.keyCode.ESCAPE:
                event.stopPropagation();
                this.hide_popover();
                break;
            case $.ui.keyCode.ENTER:
                event.preventDefault();
                this.select_item(this.$('li.o_field_item.active').data('name'));
        }
    },
    navigation_dropdown: function(keycode) {
        var $active = this.$('li.o_field_item.active');
        var $to = keycode === $.ui.keyCode.DOWN ? $active.next('.o_field_item') : $active.prev('.o_field_item');
        if ($to.length) {
            $active.removeClass('active');
            $to.addClass('active');
            this.manage_scroll();
        }
    },
    manage_scroll: function() {
        var $active = this.$('li.o_field_item.active');
        var full_height = this.$('.o_fs_page').height();
        var el_postion = $active.position().top;
        var el_height = $active.outerHeight();
        var current_scroll = this.$('.o_fs_page').scrollTop();
        if (el_postion < 0) {
            this.$('.o_fs_page').scrollTop(current_scroll - el_height);
        } else if (full_height < el_postion + el_height) {
            this.$('.o_fs_page').scrollTop(current_scroll + el_height);
        }
    },
    on_hover_dropdown: function(event) {
        this.$('li.o_field_item').removeClass('active');
        $(event.currentTarget).addClass('active');
    },
    on_input_change: function() {
        this.set_chain(this.$('input').val());
        this.validate();
        this.prefill();
    }
};


/**
 * FieldSelector
 *
 * This widget used to build field chain
 * It is field widget for form view
 *
 * Field Widget Options:
 *    - @param {string} model: can be field name or string like 'res.partner'
 *    - @param {object} filters: filter to restrict field
 */
var FieldSelector = SelectorCommon.extend(FieldSelectorCommon, {
    init: function() {
        this.init_common();
        return this._super.apply(this, arguments);
    },
    start: function() {
        var self = this;
        this.prefix = this.options.prefix || '';
        this.postfix = this.options.postfix || '';
        var sup = this._super();
        var model = this.options.model;
        if (this.field_manager.fields.hasOwnProperty(model)) {
            this.field_manager.fields[model].on('change:value', this, function() {
                if (self.view) {
                    self.view.record_loaded.then(function() {
                        self.set_ref_model();
                        if(this.model){
                            self.prefill();
                        }
                    });
                }
            });
        }
        this.set_ref_model();
        return sup;
    },
    set_ref_model: function() {
        // Returns model name from field option if model is field then it returns value of field else raw value
        var model = this.options.model;
        if (!model) {
            this.do_warn(_t('Error: Model Not Set'), _t('Set model option from field definition'));
            return;
        }
        this.model = this.field_manager.fields.hasOwnProperty(model) ? this.field_manager.get_field_value(model) : model;
    },
    set_chain: function(value) {
        this.set_value(value);
    },
    set_value: function(value) {
        this.chain = value || '';
        if(value){
            value = _.str.sprintf('%s%s%s',this.prefix || '', value, this.postfix || '');
        }
        this.$('input').val(value || '');
        this._super(value);
    },
    initialize_content: function() {
        this.validate();
    },
    get_chain: function() {
        var value = this.get_value();
        if (value && this.prefix) {
            var preRe = new RegExp("^" + this.prefix);
            value = value.replace(preRe, '');
        }
        if (value && this.postfix) {
            var postRe = new RegExp(this.postfix + '$');
            value = value.replace(postRe, '');
        }
        return value;
    },
    render_value: function() {
        if (this.get('effective_readonly')) {
            this.$el.text(this.get_value() || '');
        }
        this._super();
    }
});


/**
 * FieldSelectorWidget
 *
 * This widget used to build field chain
 * It is normal widget used anywhere (used in domain selector)
 *
 *    - @param {string} model: can be field name or string like 'res.partner'
 *    - @param {string} chain: chain value e.gcountry_id.name
 *    - @param {object} filters: filter to restrict field
 */
var FieldSelectorWidget = Widget.extend(FieldSelectorCommon, {
    init:function(model, chain, filters) {
        this.init_common();
        this.chain = chain;
        this.model = model;
        this.options = {'filters': filters || {}};
        return this._super.apply(this, arguments);
    },
    start: function() {
        var self = this;
        return this._super.apply(this, arguments).then(function() {
            if (self.chain) {
                self.prefill();
            }
        });
    }
});


/**
 * Field Selector Cache
 *
 * - It stores fields per models used in field selector
 * - Apply filter on the fly
 */
var all_field_types = ['boolean', 'char', 'date', 'datetime','float', 'integer', 'html', 'many2many', 'one2many', 'many2one', 'monetary ', 'text', 'selection'];
var field_to_read = ['store', 'searchable', 'type', 'string', 'relation', 'selection', 'related'];
var fields_cache = {
    cache: {},
    custom_filters: {},
    get_fields: function(model, filters) {
        var self = this;
        var def = $.Deferred();
        if (this.cache.hasOwnProperty(model)) {
            var val = this.filter(model, filters);
            def.resolve(val);
        } else {
            this.update_cache(model).then(function() {
                var val = self.filter(model, filters);
                def.resolve(val);
            })
        }
        return def;
    },
    update_cache: function(model) {
        var self = this;
        return new Model(model).call('fields_get_with_title', [false, field_to_read]).then(function(data) {
            var field_data = [];
            _.each(_.sortBy(_.keys(data.fields), function(f) { return data.fields[f].string; }), function(key) {
                var field_desc = data.fields[key];
                field_desc['name'] = key;
                field_data.push(field_desc);
            });
            self.cache[model] = {'title': data.title, 'fields': field_data};
        });
    },
    filter:function(model, filters) {
        filters = _.defaults(filters || {}, {searchable: true, types: [], custom_filter: false});
        var res = [];
        var data = this.cache[model];
        if (filters.searchable) {
            _.each(data.fields, function(f) {
                if (f.searchable) {
                    res.push(f);
                }
            });
        }
        if (filters.types.length !== 0) {
            var source = res || data.fields;
            res = [];
            _.each(source, function(f) {
                if (filters.types.indexOf(f.type) != -1) {
                    res.push(f);
                }
            });
        }
        if (filters.custom_filter && this.custom_filters.hasOwnProperty(filters.custom_filter)) {
            res = this.custom_filters[filters.custom_filter](res, data);
        }
        return {'title': data.title, 'fields': res};
    },
    add_custom_filters: function(name, fun_def) {
        if (_.isFunction(fun_def)) {
            this.custom_filters[name] = fun_def;
        }
    }
};

core.form_widget_registry
    .add('domain_selector', FieldDomainSelector)
    .add('field_selector', FieldSelector);

return {
    'fields_cache': fields_cache,
    'DomainSelectorEditor': DomainSelectorEditor,
    'FieldDomainSelector': FieldDomainSelector,
    'FieldSelector': FieldSelector,
    'FieldSelectorWidget': FieldSelectorWidget
};

});


odoo.define('web.form_field_selector.filter', function (require) {
'use strict';
/**
 * Custom filters to filter fields data based on need
 * e.g 'email' for selecting email with char field having name like 'email' and m2o for chain
 *     'no_account' restrict account fields (we don't need those fields in mass mailing)
 *
*/
var fields_cache = require('web.form_domain_widgets').fields_cache;

fields_cache.add_custom_filters('email', function(fields, all_data) {
    var res = [];
    _.each(fields, function(f) {
        if ((f.type == 'char' && f.name.indexOf('email') != -1) ||  f.type == 'many2one') {
            res.push(f);
        }
    });
    return res;
});

fields_cache.add_custom_filters('no_account', function(fields, all_data) {
    var res = [];
    _.each(fields, function(f) {
        if(f.name.indexOf('account') == -1 && f.name.indexOf('bank') == -1) {
            res.push(f);
        }
    });
    return res;
});

});
