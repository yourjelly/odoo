odoo.define('web_tour.Tour', function(require) {
"use strict";

var core = require('web.core');
var Tip = require('web_tour.Tip');

function getCurrentStep(name) {
    var key = 'tour_' + name + '_step';
    return parseInt(window.localStorage.getItem(key)) || 0;
}

return core.Class.extend({
    init: function() {
        this.active_tooltips = [];
        this.tours = {};
    },
    register: function() {
        var args = Array.prototype.slice.call(arguments);
        var name = args[0];
        var options = args.length === 2 ? {} : args[1];
        var steps = args[args.length - 1];

        if (!(steps instanceof Array)) {
            steps = [steps];
        }
        _.each(steps, function (step) {step.tour = name; });
        var tour = {
            name: name,
            current_step: getCurrentStep(name),
            steps: steps,
            url: options.url,
        };
        this.tours[name] = tour;
        this.active_tooltips.push(steps[tour.current_step]);
    },
     check_for_tooltip: function() {
        var self = this;
        _.each(this.active_tooltips, function (tip) {
            var $trigger = $(tip.trigger).filter(':visible');
            var triggered = $trigger.length && (tip.extra_trigger ? $(tip.extra_trigger).filter(':visible').length : true);
            if (triggered && !tip.tip) {
                console.log('tip activated', tip);
                var _tip = new Tip(self, $trigger, tip);
                tip.tip = _tip;
                _tip.appendTo($trigger);
                _tip.on('tip_consumed', self, self.consume_tip.bind(self, tip));
            }
            if (!triggered && tip.tip) {
                console.log('tip deactivated', tip);
                tip.tip.destroy();
                delete tip.tip;
            }
        });
    },
    consume_tip: function(tip) {
        console.log('consumed', tip, this.tours);
        this.active_tooltips = _.without(this.active_tooltips, tip);
        var tour = this.tours[tip.tour];
        if (tour.current_step < tour.steps.length - 1) {
            tip.tip.destroy();
            delete tip.tip;
            tour.current_step = tour.current_step + 1;
            this.active_tooltips.push(tour.steps[tour.current_step]);
        } else {
            console.log('tour completed', tour);
        }
    },
});

});
