odoo.define('open_academy.editor', function (require) {
'use strict';

var core = require('web.core');
var Model = require('web.Model');
var base = require('web_editor.base');
var options = require('web_editor.snippets.options');
var website = require('website.website');

var _t = core._t;

options.registry.my_title = options.Class.extend({
	start: function() {
		this._super.apply(this, arguments);
		// If you want to do manually then you can do something like below
		//this.$el.find(".o_select_font_color").on("click", _.bind(this.on_change_color, this));
	},
	on_change_color: function(e) {
		var $target = $(e.currentTarget);
		console.log("$target.data('select_class') ::: ", $target.data('toggle_class'));
		//this.toggle_class(null, $target.data('toggle_class'));
	}
});

});