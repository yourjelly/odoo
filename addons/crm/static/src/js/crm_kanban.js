odoo.define('crm.kanban', function (require) {
"use strict";

var KanbanView = require('web.KanbanView');
var KanbanRenderer = require('web.KanbanRenderer');
var KanbanRecord = require('web.KanbanRecord');
var KanbanColumn = require('web.KanbanColumn');
var view_registry = require('web.view_registry');
var Widget = require('web.Widget');
var session = require('web.session');


var ColumnProgressBar =  Widget.extend({
    template: 'crm.KanbanProgressBar',
    events: {
        'click .o_progress_success': function () {
            this.trigger_up('highlightSuccess');
        },
        'click .o_progress_blocked': function () {
            this.trigger_up('highlightBlocked');
        },
        'click .o_progress_warning': function () {
            this.trigger_up('highlightWarning');
        }
    },
    init: function (column) {
        this._super.apply(this, arguments);
        session.total_counter_value = session.total_counter_value || [];
        session.total_counter_value[column.db_id] = session.total_counter_value[column.db_id] || 0;
        this.db_id = column.db_id;
    },
    _update: function (records) {
        var $label = this.$('.o_kanban_counter_label');
        var $side_c = this.$('.o_kanban_counter_side');
        var $bar_success = this.$('.o_progress_success');
        var $bar_blocked = this.$('.o_progress_blocked');
        var $bar_warning = this.$('.o_progress_warning');

        var bar_n_success = 0;
        var bar_n_blocked = 0;
        var bar_n_warning = 0;

        var tot_n = records.length || parseInt($side_c.text());
        $side_c.data('current-value', tot_n);
        this.fixBarPosition();
        
        var tot_value = parseInt($side_c.text()) || 0;
        tot_n = 0;

        // Reorder bars to match CRM needs
        $bar_warning.insertBefore($bar_success);
        $bar_blocked.insertBefore($bar_warning);

        $(records).each(function() {
            var state = this.state.data.activity_state;
            tot_value = tot_value + this.record.planned_revenue.raw_value;
            tot_n++;

            if (state === "planned") {
                bar_n_success++;
                this.$el.removeClass('oe_kanban_card_blocked oe_kanban_card_warning');
                this.$el.addClass('oe_kanban_card_success');
            } else if (state === "today") {
                bar_n_warning++;
                this.$el.removeClass('oe_kanban_card_success oe_kanban_card_blocked');
                this.$el.addClass('oe_kanban_card_warning');
            } else if (state === "overdue") {
                bar_n_blocked++;
                this.$el.removeClass('oe_kanban_card_success oe_kanban_card_warning');
                this.$el.addClass('oe_kanban_card_blocked');
            }
        });

        var currency_prefix = "", currency_suffix = "";
        if(this.currency_id){
            if(session.currencies[this.currency_id].position === 'before'){
                currency_prefix = session.currencies[this.currency_id].symbol + " ";
            } else {
                currency_suffix = " " + session.currencies[this.currency_id].symbol;
            }
        }
        this._animateNumber(tot_value, $side_c, 1000, currency_prefix, currency_suffix);

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

        this.$el.removeClass('o_kanban_group_show_blocked o_kanban_group_show_success o_kanban_group_show_warning');
    },
    _animateNumber: function (end, $el, duration, prefix, suffix, bold_value) {
        suffix = suffix || "";
        prefix = prefix || "";
        bold_value = bold_value || false;
        var self = this;

        // Retrive current value (buggy)
        var start = session.total_counter_value[this.db_id] || 0;
        if (end > 1000) {
            end = end / 1000;
            suffix = "K " + suffix;
        }
        if (end > parseInt(session.total_counter_value[this.db_id]) && start != parseInt(end)) {
            $el.addClass('o-kanban-grow');
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
                session.total_counter_value[self.db_id] = Math.round(end);
                $el.removeClass('o-kanban-grow');
            }   
        });
    },
    fixBarPosition: function(){
        this.$el.affix({
            offset: {
                top: function() {
                    return (this.top = $('.o_kanban_header').outerHeight(true));
                }
            },
            target: $('.o_content'),
        });
    }
});

var CRMKanbanRecord = KanbanRecord.extend({
    update: function () {
        this._super.apply(this, arguments);
        this.trigger_up('updateProgressBar');
    },
});

var CRMKanbanColumn = KanbanColumn.extend({
    custom_events: _.extend({}, KanbanColumn.prototype.custom_events, {
        updateProgressBar: '_updateProgressBar',
        highlightSuccess: '_onHightLightSuccess',
        highlightBlocked: '_onHightLightBlocked',
        highlightWarning: '_onHightLightWarning',
    }),
    start: function () {
        this._super.apply(this, arguments);
        this.progressBar = new ColumnProgressBar(this);
        this.progressBar.insertAfter(this.$('.o_kanban_header'));
        this._updateProgressBar();
    },
    addQuickCreate: function () {
        this._super.apply(this, arguments);
        this.quickCreateWidget.insertAfter(this.progressBar.$el);
    },
    createKanbanRecord: function(record, recordOptions){
        return new CRMKanbanRecord(this, record, recordOptions);
    },
    _update: function () {
        this._super.apply(this, arguments);
        if (!this.folded && this.progressBar) {
            this._updateProgressBar();
        }
    },
    _updateProgressBar: function(){
        this.progressBar._update(this.records);
    },
    _onHightLightSuccess: function(){
        $('.o_content').scrollTop(0);
        this.$el.removeClass('o_kanban_group_show_blocked o_kanban_group_show_warning');
        this.$el.toggleClass('o_kanban_group_show_success');
    },
    _onHightLightBlocked: function(){
        $('.o_content').scrollTop(0);
        this.$el.removeClass('o_kanban_group_show_success o_kanban_group_show_warning');
        this.$el.toggleClass('o_kanban_group_show_blocked');
    },
    _onHightLightWarning: function(){
        $('.o_content').scrollTop(0);
        this.$el.removeClass('o_kanban_group_show_blocked o_kanban_group_show_success');
        this.$el.toggleClass('o_kanban_group_show_warning');
    }
});


var CRMKanbanRenderer = KanbanRenderer.extend({
    createKanbanColumn: function (state, columnOptions, recordOptions) {
        return new CRMKanbanColumn(this, state, columnOptions, recordOptions);
    },
});

var CRMKanbanView = KanbanView.extend({
    config: _.extend({}, KanbanView.prototype.config, {
        Renderer: CRMKanbanRenderer,
    }),
});

view_registry.add('crm_kanban', CRMKanbanView);

return {
    Renderer: CRMKanbanRenderer,
};

});
