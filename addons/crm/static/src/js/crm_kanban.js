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
    _animateNumber: function (end, $el, duration, prefix, suffix, bold_value) {
        suffix = suffix || "";
        prefix = prefix || "";
        bold_value = bold_value || false;
        var start = session.total_counter_value[session.active_column];
        this.trigger_up('setProgressCounter', { value: end });
        if (end > 1000) {
            end = end / 1000;
            suffix = "K " + suffix;
        }
        if (start > 1000) {
            start = start / 1000;
        }
        var progress_bar_length = (87 - (2.1)*parseInt(end).toString().length).toString() + '%';
        this.$('.o_crm_kanban_counter_progress').css('width', progress_bar_length);
        if (end > start) {
            $el.addClass('o-kanban-grow');
            $({ someValue: start}).animate({ someValue: end || 0 }, {
                duration: duration,
                easing: 'swing',
                step: function () {
                    if (bold_value) {
                        $el.html(prefix + "<b>" + Math.round(this.someValue) + "</b>" + suffix);
                    } else {
                        $el.html(prefix + Math.round(this.someValue) + suffix);
                    }
                },
                complete: function () {
                    $el.removeClass('o-kanban-grow');
                }
            });
        } else {
            if (bold_value) {
                $el.html(prefix + "<b>" + Math.round(end || 0) + "</b>" + suffix);
            } else {
                $el.html(prefix + Math.round(end || 0) + suffix);
            }
        }
    },
    _barAttrs: function () {
        this.$bar_success.attr({
            'title': this.bar_n_success + ' future activities',
            'data-original-title': this.bar_n_success + ' future activities'
        });
        this.$bar_blocked.attr({
            'title': this.bar_n_blocked + ' overdue activities',
            'data-original-title': this.bar_n_blocked + ' overdue activities'
        });
        this.$bar_warning.attr({
            'title': this.bar_n_warning + ' today activities',
            'data-original-title': this.bar_n_warning + ' today activities'
        });

        this.$bar_success.add(this.$bar_blocked).add(this.$bar_warning).tooltip({
            delay: '0',
            trigger:'hover',
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
    _update: function (records) {
        this.$label = this.$('.o_kanban_counter_label');
        this.$side_c = this.$('.o_kanban_counter_side');
        this.$bar_success = this.$('.o_progress_success');
        this.$bar_blocked = this.$('.o_progress_blocked');
        this.$bar_warning = this.$('.o_progress_warning');

        this.bar_n_success = 0;
        this.bar_n_blocked = 0;
        this.bar_n_warning = 0;

        var tot_n = records.length || parseInt(this.$side_c.text());
        this._fixBarPosition();
        
        var tot_value = 0;
        tot_n = 0;

        // Reorder bars to match CRM needs
        this.$bar_warning.insertBefore(this.$bar_success);
        this.$bar_blocked.insertBefore(this.$bar_warning);

        var self = this;
        $(records).each(function () {
            var state = this.state.data.activity_state;
            tot_value = tot_value + this.record.planned_revenue.raw_value;
            tot_n++;
            switch (state) {
                case 'planned':
                    self.bar_n_success++;
                    this.$el.removeClass('oe_kanban_card_blocked oe_kanban_card_warning');
                    this.$el.addClass('oe_kanban_card_success');
                    break;
                case 'today':
                    self.bar_n_warning++;
                    this.$el.removeClass('oe_kanban_card_success oe_kanban_card_blocked');
                    this.$el.addClass('oe_kanban_card_warning');
                    break;
                case 'overdue':
                    self.bar_n_blocked++;
                    this.$el.removeClass('oe_kanban_card_success oe_kanban_card_warning');
                    this.$el.addClass('oe_kanban_card_blocked');
                    break;
                default:
                    return
            }
        });

        this.trigger_up('setProgressCounter');
        var currency_prefix = "", currency_suffix = "";
        if (session.active_currency_id) {
            if (session.currencies[session.active_currency_id].position === 'before') {
                currency_prefix = session.currencies[session.active_currency_id].symbol + " ";
            } else {
                currency_suffix = " " + session.currencies[session.active_currency_id].symbol;
            }
        }

        this._animateNumber(tot_value, this.$side_c, 1000, currency_prefix, currency_suffix);
        this._barAttrs();

        this.bar_n_success > 0 ? this.$bar_success.width((this.bar_n_success / tot_n) * 100 + "%").addClass('o_bar_active') : this.$bar_success.width(0).removeClass('o_bar_active');
        this.bar_n_blocked > 0 ? this.$bar_blocked.width((this.bar_n_blocked / tot_n) * 100 + "%").addClass('o_bar_active') : this.$bar_blocked.width(0).removeClass('o_bar_active');
        this.bar_n_warning > 0 ? this.$bar_warning.width((this.bar_n_warning / tot_n) * 100 + "%").addClass('o_bar_active') : this.$bar_warning.width(0).removeClass('o_bar_active');

        this.$el.removeClass('o_kanban_group_show_blocked o_kanban_group_show_success o_kanban_group_show_warning');
    },
});

var CRMKanbanRecord = KanbanRecord.extend({
    update: function () {
        this._super.apply(this, arguments);
        this.trigger_up('updateProgressBar');
    },
});

var CRMKanbanColumn = KanbanColumn.extend({
    custom_events: _.extend({}, KanbanColumn.prototype.custom_events, {
        highlightSuccess: '_onHightLightSuccess',
        highlightBlocked: '_onHightLightBlocked',
        highlightWarning: '_onHightLightWarning',
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
        if (this.data.data[0] && this.relation === 'crm.stage') {
            session.active_currency_id = this.data.data[0].data.company_currency.res_id;
        }
    },
    addQuickCreate: function () {
        this._super.apply(this, arguments);
        this.quickCreateWidget.insertAfter(this.progressBar.$el);
    },
    createKanbanRecord: function (record, recordOptions) {
        return new CRMKanbanRecord(this, record, recordOptions);
    },
    _onHightLightSuccess: function () {
        $('.o_content').scrollTop(0);
        this.$el.removeClass('o_kanban_group_show_blocked o_kanban_group_show_warning');
        this.$el.toggleClass('o_kanban_group_show_success');
        $('.o_kanban_group_show_warning').css('border-color', '#68BD68');
    },
    _onHightLightBlocked: function () {
        $('.o_content').scrollTop(0);
        this.$el.removeClass('o_kanban_group_show_success o_kanban_group_show_warning');
        this.$el.toggleClass('o_kanban_group_show_blocked');
    },
    _onHightLightWarning: function () {
        $('.o_content').scrollTop(0);
        this.$el.removeClass('o_kanban_group_show_blocked o_kanban_group_show_success');
        this.$el.toggleClass('o_kanban_group_show_warning');
    },
    _update: function () {
        this._super.apply(this, arguments);
        if (!this.folded && this.progressBar) {
            this._updateProgressBar();
        }
    },
    _updateProgressBar: function () {
        this.progressBar._update(this.records);
    },
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
