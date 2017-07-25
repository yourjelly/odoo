odoo.define('project.kanban', function (require) {
"use strict";

var KanbanView = require('web.KanbanView');
var KanbanRenderer = require('web.KanbanRenderer');
var KanbanRecord = require('web.KanbanRecord');
var KanbanColumn = require('web.KanbanColumn');
var view_registry = require('web.view_registry');
var Widget = require('web.Widget');

var ColumnProgressBar =  Widget.extend({
    template: 'project.KanbanProgressBar',
    events: {
        'click .o_progress_success': function () {
            this.trigger_up('highlightSuccess');
        },
        'click .o_progress_blocked': function () {
            this.trigger_up('highlightBlocked');
        }
    },
    _update: function(records){
        var $label = this.$('.o_kanban_counter_label');
        var $side_c = this.$('.o_kanban_counter_side');
        var $bar_success = this.$('.o_progress_success');
        var $bar_blocked = this.$('.o_progress_blocked');

        var bar_n_success = 0;
        var bar_n_blocked = 0;

        var tot_n = records.length || parseInt($side_c.text());
        $side_c.data('current-value', tot_n);
        this.fixBarPosition();
        
        $(records).each(function() {
            if (this.state.data.kanban_state === "done") {
                bar_n_success++;
                this.$el.removeClass('oe_kanban_card_blocked');
                this.$el.addClass('oe_kanban_card_success');
            } else if (this.state.data.kanban_state === "blocked") {
                bar_n_blocked++;
                this.$el.removeClass('oe_kanban_card_success');
                this.$el.addClass('oe_kanban_card_blocked');
            }
        });

        bar_n_success > 0 ? $bar_success.width((bar_n_success / tot_n) * 100 + "%").addClass('o_bar_active') : $bar_success.width(0).removeClass('o_bar_active');
        bar_n_blocked > 0 ? $bar_blocked.width((bar_n_blocked / tot_n) * 100 + "%").addClass('o_bar_active') : $bar_blocked.width(0).removeClass('o_bar_active');

        $bar_success.attr({
            'title': bar_n_success + ' ready',
            'data-original-title': bar_n_success + ' ready'
        });
        $bar_success.find($label).attr('data-current-value', bar_n_success);
        $bar_blocked.attr({
            'title': bar_n_blocked + ' blocked',
            'data-original-title': bar_n_blocked + ' blocked'
        });

        $bar_success.add($bar_blocked).css('cursor', 'pointer');
        $bar_success.add($bar_blocked).tooltip({
            delay: '0',
            trigger:'hover',
            placement: 'top'
        });
        this._animateNumber(tot_n, $side_c, 1000);
        if (bar_n_success === 0 && bar_n_blocked > 0) {
            // Use blocked as label in this particular condition only
            this._animateNumber(bar_n_blocked, $label, 1000, "", " blocked");
        } else {
            this._animateNumber(bar_n_success, $label, 1000, "", " ready");
        }
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

var ProjectKanbanRecord = KanbanRecord.extend({
    update: function () {
        this._super.apply(this, arguments);
        this.trigger_up('updateProgressBar');
    },
});

var ProjectKanbanColumn = KanbanColumn.extend({
    custom_events: _.extend({}, KanbanColumn.prototype.custom_events, {
        updateProgressBar: '_updateProgressBar',
        highlightSuccess: '_onHightLightSuccess',
        highlightBlocked: '_onHightLightBlocked',
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
        return new ProjectKanbanRecord(this, record, recordOptions);
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
        this.$el.removeClass('o_kanban_group_show_blocked');
        this.$el.toggleClass('o_kanban_group_show_success');
    },
    _onHightLightBlocked: function(){
        $('.o_content').scrollTop(0);
        this.$el.removeClass('o_kanban_group_show_success');
        this.$el.toggleClass('o_kanban_group_show_blocked');
    }
});


var ProjectKanbanRenderer = KanbanRenderer.extend({
    createKanbanColumn: function(state, columnOptions, recordOptions){
        return new ProjectKanbanColumn(this, state, columnOptions, recordOptions);
    },
});

var ProjectKanbanView = KanbanView.extend({
    config: _.extend({}, KanbanView.prototype.config, {
        Renderer: ProjectKanbanRenderer,
    }),
});

view_registry.add('project_kanban', ProjectKanbanView);

return {
    Renderer: ProjectKanbanRenderer,
};


});