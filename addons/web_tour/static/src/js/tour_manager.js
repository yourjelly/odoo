odoo.define('web_tour.TourManager', function(require) {
"use strict";

var core = require('web.core');
var Model = require('web.Model');
var Tip = require('web_tour.Tip');

var _t = core._t;

function getKey(name) {
    return 'tour_' + name + '_step';
}


return core.Class.extend({
    init: function(consumed_tours) {
        this.active_tooltips = {};
        this.tours = {};
        this.consumed_tours = consumed_tours;
        this.TourModel = new Model('web_tour.tour');
    },
    register: function() {
        var args = Array.prototype.slice.call(arguments);
        var last_arg = args[args.length - 1];
        var name = args[0];
        if (this.tours[name]) {
            console.warn(_.str.sprintf(_t("Tour %s is already defined"), name));
            return;
        }
        var options = args.length === 2 ? {} : args[1];
        var steps = last_arg instanceof Array ? last_arg : [last_arg];
        var tour = {
            name: name,
            current_step: parseInt(window.localStorage.getItem(getKey(name))) || 0,
            skip_enabled: options.skip_enabled,
            steps: steps,
            url: options.url,
        };
        this.tours[name] = tour;
        if (!_.contains(this.consumed_tours, name)) {
            this.active_tooltips[name] = steps[tour.current_step];
        }
    },
    update: function() {
        _.each(this.active_tooltips, this._check_for_tooltip.bind(this));
    },
    _check_for_tooltip: function (tip, tour) {
        var $trigger = $(tip.trigger).filter(':visible').first();
        var extra_trigger = tip.extra_trigger ? $(tip.extra_trigger).filter(':visible').length : true;
        var triggered = $trigger.length && extra_trigger;
        if (triggered && !tip.widget) {
            this._activate_tip(tip, tour, $trigger);
        }
        if (!triggered && tip.widget) {
            this._unactivate_tip(tip);
        }
    },
    _activate_tip: function(tip, tour, $anchor) {
        var skip_enabled = this.tours[tour].skip_enabled;
        if (skip_enabled && !tip.extra_content) {
            // FIXME: not pretty but a cleaner solution will be easy when we'll stop using jquery's popover
            tip.extra_content = '<br/><span class="o_skip_tour">' + _t('Skip these tips.') + '</span>';
        }
        tip.widget = new Tip(this, $anchor, tip);
        tip.widget.appendTo(document.body);
        tip.widget.on('tip_consumed', this, this._consume_tip.bind(this, tip, tour));
        if (skip_enabled) {
            tip.widget.on('popover_clicked', this, function (event) {
                if (event.target.className === 'o_skip_tour') {
                    this._unactivate_tip(tip);
                    this._consume_tour(tour);
                }
            });
        }
    },
    _unactivate_tip: function(tip) {
        tip.widget.destroy();
        delete tip.widget;
    },
    _consume_tip: function(tip, tour_name) {
        this._unactivate_tip(tip);
        var tour = this.tours[tour_name];
        if (tour.current_step < tour.steps.length - 1) {
            tour.current_step = tour.current_step + 1;
            this.active_tooltips[tour_name] = tour.steps[tour.current_step];
            window.localStorage.setItem(getKey(tour_name), tour.current_step);
        } else {
            this._consume_tour(tour_name);
        }
    },
    _consume_tour: function(tour_name) {
        delete this.active_tooltips[tour_name];
        window.localStorage.removeItem(getKey(tour_name));
        this.TourModel.call('consume', [tour_name]);
    },
});

});
