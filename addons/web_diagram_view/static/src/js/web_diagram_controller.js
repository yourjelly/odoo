odoo.define('web_diagram_view.WebDiagramController', function (require) {
"use strict";

var DiagramController = require('web_diagram.DiagramController');
var core = require('web.core');
var view_dialogs = require('web.view_dialogs');

var _t = core._t;
var QWeb = core.qweb;
var FormViewDialog = view_dialogs.FormViewDialog;

/**
 * Diagram Controller
 */
var WebDiagramController = DiagramController.extend({

	/**
     * Updates the controller's title according to the new state
     *
     * @override
     * @private
     * @param {Object} state
     * @returns {Deferred}
     */
    _update: function () {
        var title = this.getTitle();
        this.set('title', title);
        return this._super.apply(this, arguments);
    },

	getTitle : function () {
		return this.model.display_name;
	},
});
return WebDiagramController;
});