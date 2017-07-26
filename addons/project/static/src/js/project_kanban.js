odoo.define('project.kanban', function (require) {
"use strict";

var KanbanView = require('web.KanbanView');
var KanbanRenderer = require('web.KanbanRenderer');
var KanbanRecord = require('web.KanbanRecord');
var KanbanColumn = require('web.KanbanColumn');
var view_registry = require('web.view_registry');
var Widget = require('web.Widget');
var session = require('web.session');


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
    _animateNumber: function (end, $el, duration, prefix, suffix, bold_value) {
        suffix = suffix || "";
        prefix = prefix || "";
        bold_value = bold_value || false;
        this.trigger_up('setProgressCounter');
        var start = session.total_counter_value[session.active_column];
        if ($el.selector === '.o_kanban_counter_side') {
            this.trigger_up('setProgressCounter', { value: end });
        }
        if (end > 1000) {
            end = end / 1000;
            suffix = "K " + suffix;
        }
        if (start > 1000) {
            start = start / 1000;
        }
        var progress_bar_length = (92 - (2.1)*parseInt(end).toString().length).toString() + '%';
        this.$('.o_kanban_counter_progress').css('width', progress_bar_length);
        if (end > start && !this.remaining) {
            console.log('this.remaining',this.remaining,":",end,":",start);
            $el.addClass('o-kanban-grow');
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
                    $el.removeClass('o-kanban-grow');
                }
            });
        } else {
            if (this.remaining) { end = 80; }
            if (bold_value) {
                $el.html(prefix + "<b>" + Math.round(end || 0) + "</b>" + suffix);
            } else {
                $el.html(prefix + Math.round(end || 0) + suffix);
            }
        }
    },
    _barAttrs: function () {
        this.$bar_success.attr({
            'title': this.bar_n_success + ' ready',
            'data-original-title': this.bar_n_success + ' ready'
        });
        this.$bar_blocked.attr({
            'title': this.bar_n_blocked + ' blocked',
            'data-original-title': this.bar_n_blocked + ' blocked'
        });

        this.$bar_success.add(this.$bar_blocked).css('cursor', 'pointer');
        this.$bar_success.add(this.$bar_blocked).tooltip({
            delay: '0',
            trigger: 'hover',
            placement: 'top'
        });
    },
    _fixBarPosition: function () {
        this.$el.affix({
            offset: {
                top: function () {
                    return (this.top = $('.o_kanban_header').outerHeight(true));
                }
            },
            target: $('.o_content'),
        });
    },
    _update: function (records, remaining) {
        console.log("UpdateCounter.....");
        this.$label = this.$('.o_kanban_counter_label');
        this.$side_c = this.$('.o_kanban_counter_side');
        this.$bar_success = this.$('.o_progress_success');
        this.$bar_blocked = this.$('.o_progress_blocked');
        this.remaining = remaining;
        this.bar_n_success = 0;
        this.bar_n_blocked = 0;

        var tot_n = records.length || parseInt(this.$side_c.text());
        this._fixBarPosition();

        var self = this;
        $(records).each(function () {
            if (this.state.data.kanban_state === "done") {
                self.bar_n_success++;
                this.$el.removeClass('oe_kanban_card_blocked');
                this.$el.addClass('oe_kanban_card_success');
            } else if (this.state.data.kanban_state === "blocked") {
                self.bar_n_blocked++;
                this.$el.removeClass('oe_kanban_card_success');
                this.$el.addClass('oe_kanban_card_blocked');
            }
        });

        this._animateNumber(tot_n, this.$side_c, 1000, "", this.remaining > 0 ? "+":"");
        if (this.bar_n_success === 0 && this.bar_n_blocked > 0) {
            if ((this.bar_n_blocked / tot_n) * 100 >= 25) {
                $(this.$label).show();
                this._animateNumber(this.bar_n_blocked, this.$label, 1000, "", " blocked");
            }
        } else {
            if ((this.bar_n_success / tot_n) * 100 >= 20) {
                $(this.$label).show();
                this._animateNumber(this.bar_n_success, this.$label, 1000, "", " ready");
            } else {
                $(this.$label).hide();
            }
        }
        this._barAttrs();
        this.bar_n_success > 0 ? this.$bar_success.width((this.bar_n_success / tot_n) * 100 + "%").addClass('o_bar_active') : this.$bar_success.width(0).removeClass('o_bar_active');
        this.bar_n_blocked > 0 ? this.$bar_blocked.width((this.bar_n_blocked / tot_n) * 100 + "%").addClass('o_bar_active') : this.$bar_blocked.width(0).removeClass('o_bar_active');
    },
});

var ProjectKanbanRecord = KanbanRecord.extend({
    update: function () {
        this._super.apply(this, arguments);
        this.trigger_up('updateProgressBar');
    },
});

var ProjectKanbanColumn = KanbanColumn.extend({
    custom_events: _.extend({}, KanbanColumn.prototype.custom_events, {
        highlightSuccess: '_onHightLightSuccess',
        highlightBlocked: '_onHightLightBlocked',
        updateProgressBar: '_updateProgressBar',
        setProgressCounter: '_setProgressCounter',
    }),
    start: function () {
        this._super.apply(this, arguments);
        this.progressBar = new ColumnProgressBar(this);
        this.progressBar.insertAfter(this.$('.o_kanban_header'));
        this._updateProgressBar();
    },
    _setProgressCounter: function (counter) {
        session.total_counter_value = session.total_counter_value || [];
        session.active_column = this.db_id;
        if (counter.data.value >= 0) {
            session.total_counter_value[this.db_id] = counter.data.value;
        } else {
            session.total_counter_value[this.db_id] = session.total_counter_value[this.db_id] || 0;
        }
    },
    addQuickCreate: function () {
        this._super.apply(this, arguments);
        this.quickCreateWidget.insertAfter(this.progressBar.$el);
    },
    createKanbanRecord: function (record, recordOptions) {
        return new ProjectKanbanRecord(this, record, recordOptions);
    },
    _onHightLightSuccess: function () {
        $('.o_content').scrollTop(0);
        this.$el.removeClass('o_kanban_group_show_blocked');
        this.$el.toggleClass('o_kanban_group_show_success');
    },
    _onHightLightBlocked: function () {
        $('.o_content').scrollTop(0);
        this.$el.removeClass('o_kanban_group_show_success');
        this.$el.toggleClass('o_kanban_group_show_blocked');
    },
    _update: function () {
        this._super.apply(this, arguments);
        if (!this.folded && this.progressBar) {
            this._updateProgressBar();
        }
    },
    // _onQuickCreateAddRecord: function (event) {
    //     this.trigger_up('quick_create_record', event.data);
    //     this._updateProgressBar();
    //     // this._super.apply(this, arguments).then(function () {
    //     // });
    // },
    _updateProgressBar: function () {
        this.progressBar._update(this.records, this.remaining);
    },
});


var ProjectKanbanRenderer = KanbanRenderer.extend({
    createKanbanColumn: function (state, columnOptions, recordOptions) {
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