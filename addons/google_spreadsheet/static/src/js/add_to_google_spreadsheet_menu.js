odoo.define('board.AddToGoogleSpreadsheetMenu', function (require) {
"use strict";

var ActionManager = require('web.ActionManager');
var core = require('web.core');
var data = require('web.data');
var Domain = require('web.Domain');
var favorites_submenus_registry = require('web.favorites_submenus_registry');
var pyUtils = require('web.py_utils');
var Widget = require('web.Widget');

var QWeb = core.qweb;

var AddToGoogleSpreadsheetMenu = Widget.extend({
    events: _.extend({}, Widget.prototype.events,
    {
        'click .add_to_spreadsheet': '_onAddToSpreadsheetClick',
    }),

    init: function (parent) {
        var self = this;
        this._super(parent);
        this.trigger_up('get_action_info', {
            callback: function (info) {
                self.actionInfo = info;
            }
        });
    },
    start: function () {
        if (this.actionInfo.actionType === 'ir.actions.act_window') {
            this._render();
        }
        return this._super.apply(this, arguments);
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Close the menu and render it
     * Here it is useless but it does not harm
     *
     */
    closeMenu: function () {
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _addToSpreadsheet: function () {
        // TO DO make the code work

        // AAB: trigger_up an event that will be intercepted by the controller,
        // as soon as the controller is the parent of the control panel
        var actionManager = this.findAncestor(function (ancestor) {
            return ancestor instanceof ActionManager;
        });
        var controller = actionManager.getCurrentController();
        var searchQuery;
        // for now the query is actually evaluated.
        this.trigger_up('get_non_evaluated_query', {
            callback: function (query) {
                searchQuery = query;
            }
        });
        var modelName = this.actionInfo.modelName;
        var list_view = _.findWhere(controller.widget.actionViews, {type: 'list'});
        var list_view_id = list_view ? list_view.viewID : false;
        var domain = searchQuery.domain;
        var groupBys = pyUtils.eval('groupbys', searchQuery.groupBys).join(" ");
        var ds = new data.DataSet(this, 'google.drive.config');

        ds.call('set_spreadsheet', [modelName, Domain.prototype.arrayToString(domain), groupBys, list_view_id])
            .done(function (res) {
                if (res.url){
                    window.open(res.url, '_blank');
                }
            });
    },
    /**
     * render and focus unique input if it is visible
     *
     * @private
     */
    _render: function () {
        var $el = QWeb.render('SearchView.addtogooglespreadsheet', {widget: this});
        this._replaceElement($el);
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {jQueryEvent} event
     */
     _onAddToSpreadsheetClick: function (event) {
        event.preventDefault();
        event.stopPropagation();
        this._addToSpreadsheet();
     },
});

favorites_submenus_registry.add('add_to_google_spreadsheet_menu', AddToGoogleSpreadsheetMenu);

return AddToGoogleSpreadsheetMenu;

});