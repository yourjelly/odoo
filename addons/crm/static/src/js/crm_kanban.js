odoo.define('crm.kanban', function (require) {
"use strict";

var core = require('web.core');
var field_utils = require('web.field_utils');
var KanbanView = require('web.KanbanView');
var KanbanModel = require('web.KanbanModel');
var KanbanRenderer = require('web.KanbanRenderer');
var KanbanController = require('web.KanbanController');
var KanbanRecord = require('web.KanbanRecord');
var KanbanColumn = require('web.KanbanColumn');
var session = require('web.session');
var view_registry = require('web.view_registry');
var session = require('web.session');

var QWeb = core.qweb;
var _t = core._t;
var _lt = core._lt;

var CRMKanbanRecord = KanbanRecord.extend({
    update: function () {
        this._super.apply(this, arguments);
        if(this.modelName === 'crm.lead'){
            this.trigger_up('updateCounter')
        }
    },
});

var CRMKanbanColumn = KanbanColumn.extend({
    custom_events: _.extend({}, KanbanColumn.prototype.custom_events, {
        'updateCounter': '_updateCounter',
    }),
    init: function (parent, data, options, recordOptions) {
        this._super.apply(this, arguments);
        this._kanbanRecord = CRMKanbanRecord;
        if(data.data[0] && this.relation === 'crm.stage'){
            this.currency_id = data.data[0].data.company_currency.res_id;
        }
    },

    start: function () {
        this._super.apply(this, arguments);
        var $ProgressBar = QWeb.render('crm.KanbanProgressBar', {
            widget: self,
        });
        jQuery($ProgressBar).insertAfter(this.$el.find('.o_kanban_header'));
        this.$counter = this.$('.o_kanban_counter');
        this._updateCounter();
    },

    addQuickCreate: function () {
        this._super.apply(this, arguments);
        this.quickCreateWidget.insertAfter(this.$counter);

        //[TODO]Copied code from project....find better solution.....as function inside function doesn't overried.
        var self = this;
        this.quickCreateWidget.$el.focusout(function () {
            var taskName = self.quickCreateWidget.$('[type=text]')[0].value;
            if (!taskName && self.quickCreateWidget) {
                self._cancelQuickCreate();
            }
        });
    },

    _update: function () {
        this._super.apply(this, arguments);
        var self = this;
        if (!this.folded) {
            self._updateCounter();
        }

    },
    
    _updateCounter: function() {
        var self = this;
        var $counter = this.$('.o_kanban_counter');
        var $label = $counter.find('.o_kanban_counter_label');
        var $side_c = $counter.find('.o_kanban_counter_side');
        var $bar_success = $counter.find('.o_progress_success');
        var $bar_blocked = $counter.find('.o_progress_blocked');
        var $bar_warning = $counter.find('.o_progress_warning');

        var bar_n_success = 0;
        var bar_n_blocked = 0;
        var bar_n_warning = 0;
        var tot_n = this.records.length || parseInt($side_c.text());
        $side_c.data('current-value', tot_n);
        
        $counter.affix({
            offset: {
                top: function() {
                    return (this.top = self.$('.o_kanban_header').outerHeight(true));
                }
            },
            target: $('.o_content'),
        });
        var tot_value = parseInt($side_c.text()) || 0;

        tot_n = 0;

        $counter.addClass('o_counter_number');

        // Reorder bars to match CRM needs
        $bar_warning.insertBefore($bar_success);
        $bar_blocked.insertBefore($bar_warning);


        $(self.records).each(function() {
            var state = this.state.data.activity_state;

            tot_value = tot_value + this.record.planned_revenue.raw_value;
            tot_n++;

            if (state == "planned") {
                bar_n_success++;
                this.$el.removeClass('oe_kanban_card_blocked oe_kanban_card_warning');
                this.$el.addClass('oe_kanban_card_success');
            } else if (state == "today") {
                bar_n_warning++;
                this.$el.removeClass('oe_kanban_card_success oe_kanban_card_blocked');
                this.$el.addClass('oe_kanban_card_warning');
            } else if (state == "overdue") {
                bar_n_blocked++;
                this.$el.removeClass('oe_kanban_card_success oe_kanban_card_warning');
                this.$el.addClass('oe_kanban_card_blocked');
            }
        });

        var currency_prefix = "", currency_suffix = "";
        if(this.currency_id){
            if(session.currencies[this.currency_id].position === 'before'){
                currency_prefix = session.currencies[this.currency_id].symbol + " ";
            }
            else{
                currency_suffix = " " + session.currencies[this.currency_id].symbol;
            }
        }

        self._animateNumber(tot_value, $side_c, 1000, currency_prefix, currency_suffix);

        $bar_success.off();
        $bar_blocked.off();
        $bar_warning.off();

        $bar_success.attr({
            'title': bar_n_success + ' future activities',
            'data-original-title': bar_n_success + ' future activities'
        });
        $bar_blocked.attr({
            'title': bar_n_blocked + ' overdue activities',
            'data-original-title': bar_n_blocked + ' overdue activities'
        });
        $bar_warning.attr({
            'title': bar_n_warning + ' today activities',
            'data-original-title': bar_n_warning + ' today activities'
        });

        $bar_success.add($bar_blocked).add($bar_warning).tooltip({
            delay: '0',
            trigger:'hover',
            placement: 'top'
        });

        bar_n_success > 0 ? $bar_success.width((bar_n_success / tot_n) * 100 + "%").addClass('o_bar_active') : $bar_success.width(0).removeClass('o_bar_active');
        bar_n_blocked > 0 ? $bar_blocked.width((bar_n_blocked / tot_n) * 100 + "%").addClass('o_bar_active') : $bar_blocked.width(0).removeClass('o_bar_active');
        bar_n_warning > 0 ? $bar_warning.width((bar_n_warning / tot_n) * 100 + "%").addClass('o_bar_active') : $bar_warning.width(0).removeClass('o_bar_active');

        self.$el.removeClass('o_kanban_group_show_blocked o_kanban_group_show_success o_kanban_group_show_warning');

        // TODO: Unbind if bars are empty
        $bar_success.on('click', function(event) {
            $('.o_content').scrollTop(0);
            self.$el.removeClass('o_kanban_group_show_blocked o_kanban_group_show_warning');
            self.$el.toggleClass('o_kanban_group_show_success');
            return false;
        });
        $bar_warning.on('click', function() {
            $('.o_content').scrollTop(0);
            self.$el.removeClass('o_kanban_group_show_blocked o_kanban_group_show_success');
            self.$el.toggleClass('o_kanban_group_show_warning');
            return false;
        });
        $bar_blocked.on('click', function() {
            $('.o_content').scrollTop(0);
            self.$el.removeClass('o_kanban_group_show_success o_kanban_group_show_warning');
            self.$el.toggleClass('o_kanban_group_show_blocked');
            return false;
        });
    },

    _animateNumber: function (end, $el, duration, prefix, suffix, bold_value) {
        suffix = suffix || "";
        prefix = prefix || "";
        bold_value = bold_value || false;

        // Retrive current value (buggy)
        var start = $el.attr('data-current-value') || 0;
        if (end > 1000) {
            end = end / 1000;
            suffix = "K " + suffix;
        }

        $({ someValue: start}).animate({ someValue: end || 0 }, {
            duration: duration,
            easing: 'swing',
            step: function() {
                if (bold_value) {
                    $el.html(prefix + "<b>" + Math.round(this.someValue) + "</b>" + suffix);
                } else {
                    $el.html(prefix + Math.round(this.someValue) + suffix);
                }
            },
            complete: function() {
                // Apply new current value
                $el.attr('data-current-value', Math.round(end));
            }
        });
    },
});


var CRMKanbanRenderer = KanbanRenderer.extend({
    init: function (parent, data, options, recordOptions) {
        this._super.apply(this, arguments);
        this._kanbanColumn = CRMKanbanColumn;
    },
    _render: function () {
        var self = this;
        return this._super.apply(this, arguments).then(function () {
            
        });
    },
});

var CRMKanbanView = KanbanView.extend({
    config: _.extend({}, KanbanView.prototype.config, {
        Model: KanbanModel,
        Renderer: CRMKanbanRenderer,
        Controller: KanbanController,
    }),
});

view_registry.add('crm_kanban', CRMKanbanView);

return {
    Model: KanbanModel,
    Renderer: CRMKanbanRenderer,
    Controller: KanbanController,
};


});