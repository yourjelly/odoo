odoo.define('point_of_sale.editor', function (require) {
    'use strict';

    var Editor = require('web_editor.snippet.editor').Editor;
    var s_options = require('web_editor.snippets.options');

    // Clone default web_editor background image functionalities
    s_options.registry.pos_background = s_options.registry.background;

    // Clone default web_editor functionalities
    s_options.registry.pos_company_logo = s_options.Class.extend({
        start: function () {
            var self = this;
            setTimeout(function(){
                self.$overlay.find('.pos-use_default_logo').removeClass("hidden");
            },500);
        }
    });

    // Hide 'remove' buttun for element that should not be removed
    s_options.registry.pos_no_remove = s_options.Class.extend({
        start:function() {
            this.$overlay.find('.oe_snippet_remove').addClass('hidden');
        }
    });
    // Full
    s_options.registry.pos_full_height = s_options.Class.extend({
        start:function() {
            this.$overlay.find('.oe_overlay_options').css('top','0px');
        }
    });

});