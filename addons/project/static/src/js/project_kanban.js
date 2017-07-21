odoo.define('project.kanban', function (require) {
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

var QWeb = core.qweb;
var _t = core._t;
var _lt = core._lt;

var ProjectKanbanRecord = KanbanRecord.extend({
    update: function () {
        this._super.apply(this, arguments);
        if(this.modelName === 'project.task'){
            this.trigger_up('updateCounter')
        }
    },
});

var ProjectKanbanColumn = KanbanColumn.extend({
    custom_events: _.extend({}, KanbanColumn.prototype.custom_events, {
        'updateCounter': '_updateCounter',
    }),
    init: function (parent, data, options, recordOptions) {
        this._super.apply(this, arguments);
        this._kanbanRecord = ProjectKanbanRecord;
    },

    start: function () {
        this._super.apply(this, arguments);
        var $ProgressBar = QWeb.render('project.KanbanProgressBar', {
            widget: self,
        });
        jQuery($ProgressBar).insertAfter(this.$el.find('.o_kanban_header'));
        this.$counter = this.$('.o_kanban_counter');
        this._updateCounter();
    },

    addQuickCreate: function () {
        this._super.apply(this, arguments);
        this.quickCreateWidget.insertAfter(this.$counter);
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
        $(self.records).each(function() {
            if (this.state.data.kanban_state == "done") {
                bar_n_success++;
                this.$el.removeClass('oe_kanban_card_blocked');
                this.$el.addClass('oe_kanban_card_success');
            } else if (this.state.data.kanban_state == "blocked") {
                bar_n_blocked++;
                this.$el.removeClass('oe_kanban_card_success');
                this.$el.addClass('oe_kanban_card_blocked');
            }
        });


        bar_n_success > 0 ? $bar_success.width((bar_n_success / tot_n) * 100 + "%").addClass('o_bar_active') : $bar_success.width(0).removeClass('o_bar_active');
        bar_n_blocked > 0 ? $bar_blocked.width((bar_n_blocked / tot_n) * 100 + "%").addClass('o_bar_active') : $bar_blocked.width(0).removeClass('o_bar_active');

        $bar_success.off();
        $bar_blocked.off();

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

        self._animateNumber(tot_n, $side_c, 1000);
        if (bar_n_success == 0 && bar_n_blocked > 0) {
            // Use blocked as label in this particular condition only
            self._animateNumber(bar_n_blocked, $label, 1000, "", " blocked");
        } else {
            self._animateNumber(bar_n_success, $label, 1000, "", " ready");
        }

        // TODO: Unbind if bars are empty
        $bar_success.on('click', function(event) {
            $('.o_content').scrollTop(0);
            self.$el.removeClass('o_kanban_group_show_blocked');
            self.$el.toggleClass('o_kanban_group_show_success');
            return false;
        });
        $bar_blocked.on('click', function(event) {
            $('.o_content').scrollTop(0);
            self.$el.removeClass('o_kanban_group_show_success');
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


var ProjectKanbanRenderer = KanbanRenderer.extend({
    init: function (parent, data, options, recordOptions) {
        this._super.apply(this, arguments);
        this._kanbanColumn = ProjectKanbanColumn;
    },
    _render: function () {
        var self = this;
        return this._super.apply(this, arguments).then(function () {
            
        });
    },
});

var ProjectKanbanView = KanbanView.extend({
    config: _.extend({}, KanbanView.prototype.config, {
        Model: KanbanModel,
        Renderer: ProjectKanbanRenderer,
        Controller: KanbanController,
    }),
});

view_registry.add('project_kanban', ProjectKanbanView);

return {
    Model: KanbanModel,
    Renderer: ProjectKanbanRenderer,
    Controller: KanbanController,
};


});