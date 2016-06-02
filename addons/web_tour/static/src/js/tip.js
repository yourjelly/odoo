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
        this.$anchor.on('click keypress', function () {
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
        var self = this;
        this.$breathing.fadeOut(100);
        this.$popover = this.$popover || this.$el.popover({
            title: this.info.title,
            content: this.info.content,
            html: true,
            animation: false,
            container: this.$el,
            placement: this.info.position,
        });

        this.$popover.popover('show');

        var element = this.$popover.find('.popover'),
            element_content = this.$popover.find('.popover-title, .popover-content'),
            elementArrow = this.$popover.find('.arrow');

        //Reset width & height to auto
        element.css({width: "auto", height: "auto"});

        var element_width = element.outerWidth(),
            element_height = element.outerHeight(),
            arrowHeight = elementArrow.outerHeight(),

            /*position tooltip & popover vertically*/
            breathingTop = this.$breathing.position().top,
            breathingCenter = breathingTop + (this.$breathing.outerHeight() / 2),
            breathingLeft = this.$breathing.position().left,
            elementTop = breathingTop,
            arrowTop = this.$breathing.outerHeight() / 2;

        element.css({opacity: 0, width: "30px", height: "30px", borderRadius: "50%", top: elementTop, left: breathingLeft});
        element_content.css({opacity: 0});

        element.animate({opacity: 1}, {duration: 100, queue: false});
        setTimeout(function (){
            element.animate({borderRadius: "2px"}, {duration: 100, queue: false});
            elementArrow.css({top: arrowTop});
        }, 50);
        setTimeout(function (){
            element.animate({width: element_width, height: element_height}, {duration: 100, queue: false});
        }, 70);
        setTimeout(function (){
            element_content.animate({opacity: 1}, {duration: 100, queue: false});
        }, 70);
    },
    to_bubble_mode: function () {
        var self = this;
        this.$breathing.show();
        var element = this.$popover.find('.popover');
        var element_content = this.$popover.find('.popover-title, .popover-content');

        element_content.animate({opacity: 0}, {duration: 100, queue: false});
        setTimeout(function (){
            element.animate({height: "30px", width: "30px", borderRadius: "50%"}, {duration: 20, queue: false});
        }, 100);
        setTimeout(function (){
            element.animate({opacity: 0}, {duration: 100, queue: false});
        }, 100, function () {
            self.$popover.popover('destroy');
            
        });
    },
});

});
