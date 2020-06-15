odoo.define('mass_mailing.website_integration', function (require) {
"use strict";

var config = require('web.config');
var core = require('web.core');
var Dialog = require('web.Dialog');
var utils = require('web.utils');
var publicWidget = require('web.public.widget');

var WysiwygMultizone = require('web_editor.wysiwyg.multizone');

var _t = core._t;

publicWidget.registry.subscribe = publicWidget.Widget.extend({
    selector: ".js_subscribe",
    disabledInEditableMode: false,
    read_events: {
        'click .js_subscribe_btn': '_onSubscribeClick',
    },

    /**
     * @override
     */
    start: function () {
        var self = this;
        var def = this._super.apply(this, arguments);
        this.$popup = this.$target.closest('.o_newsletter_modal');
        if (this.$popup.length) {
            // No need to check whether the user subscribed or not if the input
            // is in a popup as the popup won't open if he did subscribe.
            return def;
        }

        var always = function (data) {
            var isSubscriber = data.is_subscriber;
            self.$('.js_subscribe_btn').prop('disabled', isSubscriber);
            self.$('input.js_subscribe_email')
                .val(data.email || "")
                .prop('disabled', isSubscriber);
            self.$target.removeClass('d-none');
            self.$('.js_subscribe_btn').toggleClass('d-none', !!isSubscriber);
            self.$('.js_subscribed_btn').toggleClass('d-none', !isSubscriber);
        };
        return Promise.all([def, this._rpc({
            route: '/website_mass_mailing/is_subscriber',
            params: {
                'list_id': this.$target.data('list-id'),
            },
        }).then(always).guardedCatch(always)]);
    },
    /**
     * @override
     */
    destroy: function () {
        this.$target.addClass('d-none');
        this._super.apply(this, arguments);
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _onSubscribeClick: function () {
        var self = this;
        var $email = this.$(".js_subscribe_email:visible");

        if ($email.length && !$email.val().match(/.+@.+/)) {
            this.$target.addClass('o_has_error').find('.form-control').addClass('is-invalid');
            return false;
        }
        this.$target.removeClass('o_has_error').find('.form-control').removeClass('is-invalid');
        this._rpc({
            route: '/website_mass_mailing/subscribe',
            params: {
                'list_id': this.$target.data('list-id'),
                'email': $email.length ? $email.val() : false,
            },
        }).then(function (result) {
            self.$(".js_subscribe_btn").addClass('d-none');
            self.$(".js_subscribed_btn").removeClass('d-none');
            self.$('input.js_subscribe_email').prop('disabled', !!result);
            if (self.$popup.length) {
                self.$popup.modal('hide');
            }
            self.displayNotification({
                type: 'success',
                title: _t("Success"),
                message: result.toast_content,
                sticky: true,
            });
        });
    },
});

publicWidget.registry.newsletter_popup = publicWidget.Widget.extend({
    selector: ".o_newsletter_popup",
    disabledInEditableMode: false,
    /**
     * @override
     */
    start: function () {
        var self = this;
        var defs = [this._super.apply(this, arguments)];
        this.websiteID = this._getContext().website_id;
        this.listID = parseInt(this.$target.attr('data-list-id'));
        // if (!utils.get_cookie(this.listID)) {
        //     this._bindPopup();
        // }
        if (!this.listID || (utils.get_cookie(_.str.sprintf("newsletter-popup-%s-%s", this.listID, this.websiteID)) && !self.editableMode)) {
            return Promise.all(defs);
        }
        if (this.$target.data('content') && this.editableMode) {
            // To avoid losing user changes.
            this._dialogInit(this.$target.data('content'));
            this.$target.removeData('quick-open');
            this.massMailingPopup.open();
        } else {
            defs.push(this._rpc({
                route: '/website_mass_mailing/get_content',
                params: {
                    newsletter_id: self.listID,
                },
            }).then(function (data) {
                self._dialogInit(data.popup_content, data.email || '');
                if (!self.editableMode && !data.is_subscriber) {
                    if (config.device.isMobile) {
                        setTimeout(function () {
                            self._showBanner();
                        }, 5000);
                    } else {
                        $(document).on('mouseleave.open_popup_event', self._showBanner.bind(self));
                    }
                } else {
                    $(document).off('mouseleave.open_popup_event');
                }
                // show popup after choosing a newsletter
                if (self.$target.data('quick-open')) {
                    self.massMailingPopup.open();
                    self.$target.removeData('quick-open');
                }
            }));
        }

        return Promise.all(defs);
    },
    /**
     * @override
     */
    destroy: function () {
        if (this.massMailingPopup) {
            this.massMailingPopup.close();
        }
        this._super.apply(this, arguments);
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @param {string} content
     * @private
     */
    _dialogInit: function (content, email) {
        var self = this;
        this.massMailingPopup = new Dialog(this, {
            technical: false,
            $content: $('<div/>').html(content),
            $parentNode: this.$target,
            backdrop: !this.editableMode,
            dialogClass: 'p-0' + (this.editableMode ? ' oe_structure oe_empty' : ''),
            renderFooter: false,
            size: 'medium',
        });
        this.massMailingPopup.opened().then(function () {
            var $modal = self.massMailingPopup.$modal;
            $modal.find('header button.close').on('mouseup', function (ev) {
                ev.stopPropagation();
            });
            $modal.find('header button.close').on('click', function() {
                const nbDays = self.$el.find('.o_newsletter_modal').data('consentsDuration');
                utils.set_cookie(this.listID, true, nbDays * 24 * 60 * 60);
                self._hidePopup();
            });
            let dataset = self.$el[0].dataset;
            $modal.addClass('o_newsletter_modal '+dataset.layout);
            //$modal.find('.o_newsletter_modal').addClass(dataset.layout);
            //$modal.find('.s_newsletter_popup_frame').addClass(dataset.modalSize);
            $modal.find('.oe_structure').attr('data-editor-message', _t('DRAG BUILDING BLOCKS HERE'));
            $modal.find('.modal-dialog').addClass('modal-dialog-centered '+dataset.modalSize);
            if (dataset.backdropColor) {

                $modal[0].style.backgroundColor = dataset.backdropColor;
            }
            debugger;
            if (dataset.textColor) {

                $modal.find('.s_newsletter_text')[0].style.color = dataset.textColor;
            }
            $modal.find('.js_subscribe').data('list-id', self.listID)
                  .find('input.js_subscribe_email').val(email);
            self.trigger_up('widgets_start_request', {
                editableMode: self.editableMode,
                $target: $modal,
            });
        });
        this.massMailingPopup.on('closed', this, function () {
            var $modal = self.massMailingPopup.$modal;
            if ($modal) { // The dialog might have never been opened
                self.$el.data('content', $modal.find('.modal-body').html());
            }
        });
    },
    /**
     * @private
     */
    _showBanner: function () {
        this.massMailingPopup.open();
        utils.set_cookie(_.str.sprintf("newsletter-popup-%s-%s", this.listID, this.websiteID), true);
        $(document).off('mouseleave.open_popup_event');
    },
    _bindPopup: function () {
        debugger;

        let display = this.$target.data('display');
        let delay = this.$target.data('showAfter');

        if (config.device.isMobile) {
            if (display === 'onExit') {
                display = 'afterDelay';
                delay = 5000;
            }
            this.$('.o_newsletter_popup').removeClass('s_newsletter_center').addClass('s_newsletter_bottom');
        }

        if (display === 'afterDelay') {
            this.timeout = setTimeout(() => this._showPopup(), delay);
        } else {
            $(document).on('mouseleave.open_event', () => this._showPopup());
        }
    },
     _showPopup: function () {
        this.$target.find('.o_newsletter_popup').removeClass('d-none');
    },
    _hidePopup: function () {
        this.$target.find('.o_newsletter_modal').addClass('d-none');
    },
});
});
