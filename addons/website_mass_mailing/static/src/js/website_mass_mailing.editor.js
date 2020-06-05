odoo.define('website_mass_mailing.editor', function (require) {
'use strict';

var core = require('web.core');
var rpc = require('web.rpc');
var WysiwygMultizone = require('web_editor.wysiwyg.multizone');
var options = require('web_editor.snippets.options');
var wUtils = require('website.utils');

const qweb = core.qweb;
var _t = core._t;


options.registry.mailing_list_subscribe = options.Class.extend({
    popup_template_id: "editor_new_mailing_list_subscribe_button",
    popup_title: _t("Add a Newsletter Subscribe Button"),

    //--------------------------------------------------------------------------
    // Options
    //--------------------------------------------------------------------------

    /**
     * Creates a new mailing.list through a modal prompt.
     *
     * @see this.selectClass for parameters
     */
    createMailingList: function (previewMode, widgetValue, params) {
        return wUtils.prompt({
            id: this.popup_template_id,
            window_title: this.popup_title,
            input: _t("Name"),
        }).then((result) => {
            var name = result.val;
            if (!name) {
                return;
            }
            return this._rpc({
                model: 'mailing.list',
                method: 'create',
                args: [{
                    name: name,
                    is_public: true,
                }],
            }).then((id) => {
                this.$target.attr("data-list-id", id);
                return this._rerenderXML();
            });
        });
    },

    /**
     * @override
     */
    onBuilt: function () {
        this._super();
        const mailingListID = this._getMailingListID();
        if (mailingListID) {
            this.$target.attr("data-list-id", mailingListID);
        } else {
            this.createMailingList('click').guardedCatch(() => {
                this.getParent()._onRemoveClick($.Event( "click" ));
            });
        }
    },
    /**
     * Replace the current mailing_list_ID with the existing mailing_list_id selected.
     */
    selectMailingList: function (previewMode, widgetValue, params) {
        this.$target.attr("data-list-id", widgetValue);
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    _renderCustomXML: function (uiFragment) {
        return this._getMailingListButtons().then((mailingLists) => {
            this.mailingLists = mailingLists;
            const selectEl = uiFragment.querySelector('we-select[data-name="mailing_list"]');
            if (this.mailingLists.length) {
                this.mailingLists.forEach(option => selectEl.append(option.cloneNode(true)));
            }
        });
    },
    /**
     * @override
     */
    _computeWidgetState: function (methodName, params) {
        if (methodName === 'selectMailingList') {
            return this._getMailingListID();
        }
        return this._super(...arguments);
    },
    /**
     * @private
     */
    _getMailingListButtons: function () {
        return rpc.query({
            model: 'mailing.list',
            method: 'name_search',
            args: ['', [['is_public', '=', true]]],
            context: this.options.recordInfo.context,
        }).then((data) => {
            // Create the buttons for the mailing list we-select
            return Object.keys(data).map(key => {
                const record = data[key];
                const button = document.createElement('we-button');
                button.dataset.selectMailingList = record[0];
                button.textContent = record[1];
                return button;
            });
        });
    },
    /**
     * @private
     */
    _getMailingListID: function () {
        let listID = parseInt(this.$target.attr('data-list-id'));
        if (!listID && this.mailingLists.length) {
            listID = this.mailingLists[0].dataset.selectMailingList;
        }
        return listID;
    },
});

options.registry.recaptchaSubscribe = options.Class.extend({
    xmlDependencies: ['/google_recaptcha/static/src/xml/recaptcha.xml'],

    /**
     * Toggle the recaptcha legal terms
     */
    toggleRecaptchaLegal: function (previewMode, value, params) {
        const recaptchaLegalEl = this.$target[0].querySelector('.o_recaptcha_legal_terms');
        if (recaptchaLegalEl) {
            recaptchaLegalEl.remove();
        } else {
            const template = document.createElement('template');
            template.innerHTML = qweb.render("google_recaptcha.recaptcha_legal_terms");
            this.$target[0].appendChild(template.content.firstElementChild);
        }
    },

    //----------------------------------------------------------------------
    // Private
    //----------------------------------------------------------------------

    /**
     * @override
     */
    _computeWidgetState: function (methodName, params) {
        switch (methodName) {
            case 'toggleRecaptchaLegal':
                return !this.$target[0].querySelector('.o_recaptcha_legal_terms') || '';
        }
        return this._super(...arguments);
    },
});

options.registry.newsletter_popup = options.registry.mailing_list_subscribe.extend({
    popup_template_id: "editor_new_mailing_list_subscribe_popup",
    popup_title: _t("Add a Newsletter Subscribe Popup"),

    /**
     * @override
     */
    start: function () {
        this.$target.on('hidden.bs.modal.newsletter_popup_option', () => {
            this.trigger_up('snippet_option_visibility_update', {show: false});
        });
        return this._super(...arguments);
    },
    /**
     * @override
     */
    onTargetShow: function () {
        // Open the modal
        this.$target.data('quick-open', true);
        return this._refreshPublicWidgets();
    },
    /**
     * @override
     */
    onTargetHide: function () {
        // Close the modal
        const $modal = this.$('.modal');
        if ($modal.length && $modal.is('.modal_shown')) {
            $modal.modal('hide');
        }
    },
    /**
     * @override
     */
    cleanForSave: function () {
        var self = this;
        var content = this.$target.data('content');
        if (content) {
            this.trigger_up('get_clean_html', {
                $layout: $('<div/>').html(content),
                callback: function (html) {
                    self.$target.data('content', html);
                },
            });
        }
        this._super.apply(this, arguments);
    },
    /**
     * @override
     */
    destroy: function () {
        this.$target.off('.newsletter_popup_option');
        this._super.apply(this, arguments);
    },

    //--------------------------------------------------------------------------
    // Options
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    createMailingList: function () {
        var self = this;
        return this._super.apply(this, arguments).then(function () {
            self.$target.data('quick-open', true);
            self.$target.removeData('content');
            return self._refreshPublicWidgets();
        });
    },
});

WysiwygMultizone.include({

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    _saveElement: function (outerHTML, recordInfo, editable) {
        var self = this;
        var defs = [this._super.apply(this, arguments)];
        var $popups = $(editable).find('.o_newsletter_popup');
        _.each($popups, function (popup) {
            var $popup = $(popup);
            var content = $popup.data('content');
            if (content) {
                defs.push(self._rpc({
                    route: '/website_mass_mailing/set_content',
                    params: {
                        'newsletter_id': parseInt($popup.attr('data-list-id')),
                        'content': content,
                    },
                }));
            }
        });
        return Promise.all(defs);
    },
});
});
