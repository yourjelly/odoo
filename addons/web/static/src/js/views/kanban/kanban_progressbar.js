odoo.define('kanban.progressBar', function (require) {
"use strict";

var Widget = require('web.Widget');
var session = require('web.session');


var ColumnProgressBar =  Widget.extend({
    template: 'KanbanView.ProgressBar',
    events: {
        'click .progress-bar': function (e) {
            $('.o_content').scrollTop(0);
            var state = $(e.currentTarget).data('state');
            var is_toggle = this.$el.closest('.o_kanban_group').is('.o_kanban_group_show_'+this.colors[state])
            this.$el.closest('.o_kanban_group').removeClass('o_kanban_group_show_danger o_kanban_group_show_success o_kanban_group_show_warning');
            if(is_toggle){
                 var sum = _.reduce(this.result, function(sum, data){ return sum + data.val || 0;}, 0)
                 this._animateNumber(sum, this.$side_c, 1000, this.currency_prefix, this.remaining > 0 ? this.currency_prefix+"+":this.currency_suffix);
            } else {
                 this._animateNumber(this.result[state].val, this.$side_c, 1000, this.currency_prefix, this.remaining > 0 ? this.currency_prefix+"+":this.currency_suffix);
                 this.$el.closest('.o_kanban_group').toggleClass('o_kanban_group_show_'+this.colors[state]);
            }
        }
    },
    init: function (parent, barOptions, fieldsInfo) {
        this._super.apply(this, arguments);
        this.sum_field = barOptions.attrs.sum;
        this.field = barOptions.attrs.field;
        this.colors = JSON.parse(barOptions.attrs.colors);
        this.trigger_up('setProgressCounter');
        this.is_monetary = false;

        if (this.sum_field && fieldsInfo[this.sum_field]['widget'] == 'monetary') {
            this.is_monetary = true;
            this.findCurrency();
        }
    },
    findCurrency: function () {
        this.currency_prefix = "";
        this.currency_suffix = "";

        if (this.is_monetary) {
            if (session.currencies[session.active_currency_id].position === 'before') {
                this.currency_prefix = session.currencies[session.active_currency_id].symbol + " ";
            } else {
                this.currency_suffix = " " + session.currencies[session.active_currency_id].symbol;
            }
        }
    },
    sideCounter: function (records) {
        this.result = {};
        var self = this;

        $(records).each(function () {
            var group_field = this.state.data[self.field];
            if (!self.result.hasOwnProperty(group_field)) {
                self.result[group_field] = {
                    val: 0,
                    count: 0
                };
            }
            var data = self.result[group_field];
            if (self.sum_field) {
                data.val += this.state.data[self.sum_field];
            } else {
                data.val += 1;
            }
            data.count += 1;
            if(self.colors[group_field]){
                this.$el.addClass('oe_kanban_card_'+ self.colors[group_field]);
            }
        });

        var sum = _.reduce(self.result, function(sum, data){ return sum + data.val;}, 0)
        var sum_count = _.reduce(self.result, function(sum, data){ return sum + data.count;}, 0)
        this._animateNumber(sum, this.$side_c, 1000, this.currency_prefix, this.remaining > 0 ? this.currency_prefix+"+":this.currency_suffix);

        for (var value in this.result) {
            var data_temp_val = this['bar_n_'+this.colors[value]];
            var $data_temp_model = this['$bar_'+this.colors[value]];
            data_temp_val = this.result[value].count;
            if ($data_temp_model) {
                data_temp_val > 0 ? $data_temp_model.width((data_temp_val / sum_count) * 100 + "%").addClass('o_bar_active') : $data_temp_model.width(0).removeClass('o_bar_active');
            }
        }
    },
    _animateNumber: function (end, $el, duration, prefix, suffix) {
        suffix = suffix || "";
        prefix = prefix || "";
        var start = session.total_counter_value[session.active_column];
        this.trigger_up('setProgressCounter', { value: end });

        if (end > 1000000) {
            end = end / 1000000;
            suffix = "M " + suffix;
        }
        else if (end > 1000) {
            end = end / 1000;
            suffix = "K " + suffix;
        }
        if (start > 1000000) {
            start = start / 1000000;
        }
        else if (start > 10000) {
            start = start / 10000;
        }

        var progress_bar_length = (90 - (2.8)*parseInt(end).toString().length).toString() + '%';
        this.$('.o_kanban_counter_progress').css('width', progress_bar_length);

        if (end > start) {
            $el.addClass('o-kanban-grow');
            $({ someValue: start}).animate({ someValue: end || 0 }, {
                duration: duration,
                easing: 'swing',
                step: function () {
                    $el.html(prefix + Math.round(this.someValue) + suffix);
                },
                complete: function () {
                    $el.removeClass('o-kanban-grow');
                }
            });
        } else {
            $el.html(prefix + Math.round(end || 0) + suffix);
        }
    },
    _barAttrs: function () {
        for (var value in this.result) {
            var data_temp_val = this['bar_n_'+this.colors[value]];
            var $data_temp_model = this['$bar_'+this.colors[value]];
            data_temp_val = this.result[value].count;
            if ($data_temp_model) {
                $data_temp_model.attr({
                    'title': data_temp_val + ' '+value,
                    'data-original-title': data_temp_val + ' '+value,
                    'data-state': value
                });
                $data_temp_model.tooltip({
                    delay: '0',
                    trigger:'hover',
                    placement: 'top'
                });
            }
        }
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
        this.$label = this.$('.o_kanban_counter_label');
        this.$side_c = this.$('.o_kanban_counter_side');
        this.$bar_success = this.$('.o_progress_success');
        this.$bar_danger = this.$('.o_progress_danger');
        this.$bar_warning = this.$('.o_progress_warning');
        this.bar_n_success = 0;
        this.bar_n_danger = 0;
        this.bar_n_warning = 0;
        this.remaining = remaining;
        this.records = records;

        this._fixBarPosition();
        this.sideCounter(this.records);
        this._barAttrs();
        this.$el.removeClass('o_kanban_group_show_danger o_kanban_group_show_success o_kanban_group_show_warning');
    },
});

return {
    ColumnProgressBar: ColumnProgressBar,
}

});
