odoo.define('web_tour.Tip', function(require) {
"use strict";

var Widget = require('web.Widget');

return Widget.extend({
    template: "Tip",
    init: function(parent, $anchor, info) {
        this._super(parent);
        this.$anchor = $anchor;
        this.info = info;
    },
    start: function() {
        var self = this;
        this.$breathing = this.$('.oe_breathing');
        this.$el.on('mouseenter', function() {
            self.$breathing.addClass('oe_explode').fadeOut(300);
            self.display_info();
            self.trigger('tip_consumed', self);
        });
        this.reposition();
    },
    reposition: function() {
        this.$breathing.position({ my: "left", at: "right", of: this.$anchor });
    },
    display_info: function() {
        var popover = this.$el.popover({
            title: this.info.title,
            content: this.info.content,
            html: true,
            animation: false,
            placement: this.info.position,
        });
        popover.popover('show');
    },
});

});
