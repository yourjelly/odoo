odoo.define('web.ActionMixin', function (require) {
"use strict";

/**
 * We define here the ActionMixin, the generic notion of action (from the point
 * of view of the web client).  In short, an action is a widget which controls
 * the main part of the screen (everything below the control panel).
 *
 * More precisely, the action manager is the component that coordinates a stack
 * of actions.  Whenever the user navigates in the interface, switches views,
 * open different menus, the action manager creates/updates/destroys special
 * widgets which implements the ActionMixin.  These actions need to answer to a
 * standardised API, which is the reason for this mixin.
 *
 * In practice, most actions are view controllers (coming from a
 * ir.action.act_window).  However, some actions are 'client actions'.  They
 * also need to implement the ActionMixin for a better cooperation with the
 * action manager.
 *
 * @module web.ActionMixin
 */

var core = require('web.core');

var ActionMixin = {
    template: 'Action',
    _controlPanel: null,
    _title: '',

    // init: function () {
        // AAB: change this logic to stop using the properties mixin
        // this.on("change:title", this, function () {
        //     if (self._controlPanel) {
        //         var breadcrumbs = self._getBreadcrumbs();
        //         // TODO: handle breadcrumbs
        //         // self._controlPanel.updateContents({breadcrumbs: breadcrumbs}, {clear: false});
        //     }
        // });
    // },
    renderElement: function () {
        this._super.apply(this, arguments);
        if (this.contentTemplate) {
            this.$('.o_content').append(core.qweb.render(this.contentTemplate, {widget: this}));
        }
    },
    /**
     * Called each time the action is attached into the DOM.
     */
    on_attach_callback: function () {},
    /**
     * Called each time the action is detached from the DOM.
     */
    on_detach_callback: function () {},
    /**
     * Called by the action manager when action is restored (typically, when the
     * user clicks on the action in the breadcrumb)
     *
     * @returns {Deferred|undefined}
     */
    willRestore: function () {},

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * In some situations, we need confirmation from the controller that the
     * current state can be destroyed without prejudice to the user.  For
     * example, if the user has edited a form, maybe we should ask him if we
     * can discard all his changes when we switch to another action.  In that
     * case, the action manager will call this method.  If the returned
     * deferred is succesfully resolved, then we can destroy the current action,
     * otherwise, we need to stop.
     *
     * @returns {Deferred} resolved if the action can be removed, rejected otherwise
     */
    canBeRemoved: function () {
        return $.when();
    },
    /**
     * This function is called when the current context (~state) of the action
     * should be known. For instance, if the action is a view controller,
     * this may be useful to reinstantiate the view in the same state.
     */
    getContext: function () {
    },
    /**
     * Returns a title that may be displayed in the breadcrumb area.  For
     * example, the name of the record (for a form view). This is actually
     * important for the action manager: this is the way it is able to give
     * the proper titles for other actions.
     *
     * @returns {string}
     */
    getTitle: function () {
        return this._title;
    },
    /**
     * Gives the focus to the action
     */
    giveFocus: function () {
    },
    /**
     * Renders the buttons to append, in most cases, to the control panel (in
     * the bottom left corner). When the action is rendered in a dialog, those
     * buttons might be moved to the dialog's footer.
     *
     * @param {jQuery Node} $node
     */
    renderButtons: function ($node) {
    },
    // TMP
    updateControlPanel: function (status, options) {
        if (this._controlPanel) {
            this._controlPanel.updateContents(status || {}, options || {});
        }
    },
    // TODO: add hooks methods:
    // - onRestoreHook (on_reverse_breadcrumbs)

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {string} title
     */
    _setTitle: function (title) {
        this._title = title;
        this.updateControlPanel({title: this._title}, {clear: false});
    },
};

return ActionMixin;

});
