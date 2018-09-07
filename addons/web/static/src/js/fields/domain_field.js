odoo.define('web.domain_field', function (require) {
"use strict";


var AbstractField = require('web.AbstractField');
var core = require('web.core');
var Domain = require('web.Domain');
var DomainSelector = require('web.DomainSelector');
var DomainSelectorDialog = require('web.DomainSelectorDialog');
var view_dialogs = require('web.view_dialogs');
var session = require('web.session');

var qweb = core.qweb;
var _t = core._t;

/**
 * The "Domain" field allows the user to construct a technical-prefix domain
 * thanks to a tree-like interface and see the selected records in real time.
 * In debug mode, an input is also there to be able to enter the prefix char
 * domain directly (or to build advanced domains the tree-like interface does
 * not allow to).
 */

var FieldDomain = AbstractField.extend({
    /**
     * Fetches the number of records which are matched by the domain (if the
     * domain is not server-valid, the value is false) and the model the
     * field must work with.
     */
    specialData: "_fetchSpecialDomain",

    events: _.extend({}, AbstractField.prototype.events, {
        "click .o_domain_show_selection_button": "_onShowSelectionButtonClick",
        "click .o_field_domain_dialog_button": "_onDialogEditButtonClick",
    }),
    custom_events: _.extend({}, AbstractField.prototype.custom_events, {
        domain_changed: "_onDomainSelectorValueChange",
        domain_selected: "_onDomainSelectorDialogValueChange",
        open_record: "_onOpenRecord",
    }),
    /**
     * @constructor
     * @override init from AbstractField
     */
    init: function () {
        this._super.apply(this, arguments);

        this.inDialog = !!this.nodeOptions.in_dialog;
        this.fsFilters = this.nodeOptions.fs_filters || {};

        this.className = "o_field_domain";
        if (this.mode === "edit") {
            this.className += " o_edit_mode";
        }
        if (!this.inDialog) {
            this.className += " o_inline_mode";
        }

        this._setState();
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * A domain field is always set since the false value is considered to be
     * equal to "[]" (match all records).
     *
     * @override
     */
    isSet: function () {
        return true;
    },
    /**
     * @override isValid from AbstractField.isValid
     * Parsing the char value is not enough for this field. It is considered
     * valid if the internal domain selector was built correctly and that the
     * query to the model to test the domain did not fail.
     *
     * @returns {boolean}
     */
    isValid: function () {
        return (
            this._super.apply(this, arguments)
            && (!this.domainSelector || this.domainSelector.isValid())
            && this._isValidForModel
        );
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     * @override _render from AbstractField
     * @returns {Deferred}
     */
    _render: function () {
        // If there is no model, only change the non-domain-selector content
        if (!this._domainModel) {
            this._replaceContent();
            return $.when();
        }

        // Convert char value to array value
        var value = this.value || "[]";
        var domain = Domain.prototype.stringToArray(value);

        // Create the domain selector or change the value of the current one...
        var def;
        if (!this.domainSelector) {
            this.domainSelector = new DomainSelector(this, this._domainModel, domain, {
                readonly: this.mode === "readonly" || this.inDialog,
                filters: this.fsFilters,
                debugMode: session.debug,
            });
            def = this.domainSelector.prependTo(this.$el);
        } else {
            def = this.domainSelector.setDomain(domain);
        }
        // ... then replace the other content (matched records, etc)
        return def.then(this._replaceContent.bind(this));
    },
    /**
     * Render the field DOM except for the domain selector part. The full field
     * DOM is composed of a DIV which contains the domain selector widget,
     * followed by other content. This other content is handled by this method.
     *
     * @private
     */
    _replaceContent: function () {
        if (this._$content) {
            this._$content.remove();
        }
        this._$content = $(qweb.render("FieldDomain.content", {
            hasModel: !!this._domainModel,
            isValid: !!this._isValidForModel,
            nbRecords: this.record.specialData[this.name].nbRecords || 0,
            inDialogEdit: this.inDialog && this.mode === "edit",
        }));
        this._$content.appendTo(this.$el);
    },
    /**
     * @override _reset from AbstractField
     * Check if the model the field works with has (to be) changed.
     *
     * @private
     */
    _reset: function () {
        this._super.apply(this, arguments);
        var oldDomainModel = this._domainModel;
        this._setState();
        if (this.domainSelector && this._domainModel !== oldDomainModel) {
            // If the model has changed, destroy the current domain selector
            this.domainSelector.destroy();
            this.domainSelector = null;
        }
    },
    /**
     * Sets the model the field must work with and whether or not the current
     * domain value is valid for this particular model. This is inferred from
     * the received special data.
     *
     * @private
     */
    _setState: function () {
        var specialData = this.record.specialData[this.name];
        this._domainModel = specialData.model;
        this._isValidForModel = (specialData.nbRecords !== false);
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * Called when the "Show selection" button is clicked
     * -> Open a modal to see the matched records
     *
     * @param {Event} e
     */
    _onShowSelectionButtonClick: function (e) {
        e.preventDefault();
        new view_dialogs.SelectCreateDialog(this, {
            title: _t("Selected records"),
            res_model: this._domainModel,
            domain: this.value || "[]",
            no_create: true,
            readonly: true,
            disable_multiple_selection: true,
        }).open();
    },
    /**
     * Called when the "Edit domain" button is clicked (when using the in_dialog
     * option) -> Open a DomainSelectorDialog to edit the value
     *
     * @param {Event} e
     */
    _onDialogEditButtonClick: function (e) {
        e.preventDefault();
        new DomainSelectorDialog(this, this._domainModel, this.value || "[]", {
            readonly: this.mode === "readonly",
            filters: this.fsFilters,
            debugMode: session.debug,
        }).open();
    },
    /**
     * Called when the domain selector value is changed (do nothing if it is the
     * one which is in a dialog (@see _onDomainSelectorDialogValueChange))
     * -> Adapt the internal value state
     *
     * @param {OdooEvent} e
     */
    _onDomainSelectorValueChange: function (e) {
        if (this.inDialog) return;
        this._setValue(Domain.prototype.arrayToString(this.domainSelector.getDomain()));
    },
    /**
     * Called when the in-dialog domain selector value is confirmed
     * -> Adapt the internal value state
     *
     * @param {OdooEvent} e
     */
    _onDomainSelectorDialogValueChange: function (e) {
        this._setValue(Domain.prototype.arrayToString(e.data.domain));
    },
    /**
     * Stops the propagation of the 'open_record' event, as we don't want the
     * user to be able to open records from the list opened in a dialog.
     *
     * @param {OdooEvent} event
     */
    _onOpenRecord: function (event) {
        event.stopPropagation();
    },
});

return FieldDomain;

});
