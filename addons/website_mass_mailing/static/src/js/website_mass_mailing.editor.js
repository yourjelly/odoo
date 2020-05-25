odoo.define('website_mass_mailing.editor', function (require) {
'use strict';

var core = require('web.core');
var rpc = require('web.rpc');
var WysiwygMultizone = require('web_editor.wysiwyg.multizone');
require('website.s_popup_options');
var _t = core._t;


options.registry.mailing_list_subscribe = options.Class.extend({
    //--------------------------------------------------------------------------
    // Options
    //--------------------------------------------------------------------------
    init: function () {
        this._super.apply(this, arguments);
    },

    willStart: async function () {
        const _super = this._super.bind(this);
        var self = this;
        this.selectMenuEl = await this._rpc({
            model: 'mailing.list',
            method: 'name_search',
            args: ['', [['is_public', '=', true]]],
            context: self.options.recordInfo.context,
        }).then(function (data) {
                return Object.keys(data).map(key => {
                    const maillist = data[key];
                    const button = document.createElement('we-button');
                    button.dataset.selectMenuEl = maillist[0];
                    button.textContent = maillist[1];
                    return button;
                }).sort((a, b) => (a.textContent > b.textContent) ? 1 : (a.textContent < b.textContent) ? -1 : 0);
            });
        return _super(...arguments);
    },
    /**
     * Allows to select mailing list.
     *
     * @see this.selectClass for parameters
     */
    select_mailing_list: function (previewMode, value) {
        var self = this;
        var def = this._rpc({
                model: 'mailing.list',
                method: 'name_search',
                args: ['', [['is_public', '=', true]]],
                context: self.options.recordInfo.context,
            }).then(function (data) {
                var list_id = self.$target.attr("data-list-id");
                return data;
            });
        def.then(function (result) {
            self.$target.attr("data-list-id", result.val);
        });
        return def;
    },
    /**
     * @override
     */
    onBuilt: function () {
        var self = this;
        this._super();
        this._assignUniqueID();
        this.select_mailing_list('click').guardedCatch(function () {
            self.getParent()._onRemoveClick($.Event( "click" ));
        });
    },

    /**
    *@override
    */
    _assignUniqueID: function () {
        this.$target.closest('.s_newsletter_block').attr('id', 'sNewsletterBlock' + Date.now());
    },

    _getSelect: function () {
        return this.$target[0].querySelector('select');
    },

    /**
    *@override
    */
    _renderCustomXML: function (uiFragment) {
        const menuEl = uiFragment.querySelector('we-select[data-name="mail_list"]');
        if (this.selectMenuEl.length) {
            this.selectMenuEl.forEach(option => menuEl.append(option.cloneNode(true)));
        }

    },
});

options.registry.newsletter_popup = options.registry.mailing_list_subscribe.extend({

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
    select_mailing_list: function () {
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
