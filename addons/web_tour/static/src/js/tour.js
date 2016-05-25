odoo.define('web_tour.Tour', function(require) {
"use strict";

var core = require('web.core');

return core.Class.extend({
    init: function() {
        this.tooltips = {};
        this.popovers = [];
    },
    register: function(name, description) {
        this.tooltips[name] = description;
    },
    check_for_tooltip: function() {
        var self = this;
        _.each(this.tooltips, function (tip) {
            var $trigger = $(tip.trigger);
            if ($trigger.length) {
                self.remove_displayed_tips();
                self.show_tip($trigger, tip);
            }
        });
    },
    remove_displayed_tips: function() {
        while (this.popovers.length) {
            this.popovers.pop().popover('destroy');
        }
    },
    show_tip: function($trigger, tip) {
        var popover = $trigger.popover({
            title: tip.title,
            content: tip.content,
            html: true,
            container: 'body',
            animation: false,
            placement: tip.position,
        });
        popover.popover('show');

        this.popovers.push(popover);
    },
});

});
