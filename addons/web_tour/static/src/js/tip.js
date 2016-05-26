odoo.define('web_tour.Tip', function(require) {
"use strict";

var Widget = require('web.Widget');

return Widget.extend({
    template: "Tip",
    init: function(parent, $anchor, info) {
        this._super(parent);
        this.$anchor = $anchor;
        this.info = info;
        this.consumed = false;
    },
    start: function() {
        var self = this;
        this.$breathing = this.$('.oe_breathing');
        this.$anchor.on('mouseenter', this.to_info_mode.bind(this));
        this.$anchor.on('mouseleave', this.to_bubble_mode.bind(this));
        this.$anchor.on('click', function () {
            if (this.consumed) return;
            this.consumed = true;
            self.trigger('tip_consumed');
        });
        this.reposition();
    },
    reposition: function() {
        this.$breathing.position({ my: "left", at: "right", of: this.$anchor });
        if (this.$popover) {
            this.$popover.position({ my: "left", at: "right", of: this.$anchor });
        }
    },
    to_info_mode: function() {
        this.$breathing.fadeOut(300);
        this.$popover = this.$popover || this.$el.popover({
            title: this.info.title,
            content: this.info.content,
            html: true,
            animation: false,
            container: this.$el,
            placement: this.info.position,
        });
        this.$popover.popover('show');
    },
    to_bubble_mode: function () {
        this.$breathing.show();
        this.$popover.popover('hide');
    },
});

});
