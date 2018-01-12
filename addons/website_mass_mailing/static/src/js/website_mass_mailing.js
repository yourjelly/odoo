odoo.define('mass_mailing.website_integration', function (require) {
"use strict";

var utils = require('web.utils');
var sAnimation = require('website.content.snippets.animation');

sAnimation.registry.subscribe = sAnimation.Class.extend({
    selector: ".js_subscribe",
    start: function () {
        var self = this;

        // set value and display button
        self.$target.find("input").removeClass("hidden");
        this._rpc({
            route: '/website_mass_mailing/is_subscriber',
            params: {
                list_id: this.$target.data('list-id'),
            },
        }).always(function (data) {
            self.$target.find('input.js_subscribe_email')
                .val(data.email ? data.email : "")
                .attr("disabled", data.is_subscriber && data.email.length ? "disabled" : false);
            self.$target.attr("data-subscribe", data.is_subscriber ? 'on' : 'off');
            self.$target.find('a.js_subscribe_btn')
                .attr("disabled", data.is_subscriber && data.email.length ? "disabled" : false);
            self.$target.removeClass("hidden");
            self.$target.find('.js_subscribe_btn').toggleClass('hidden', !!data.is_subscriber);
            self.$target.find('.js_subscribed_btn').toggleClass('hidden', !data.is_subscriber);
        });

        // not if editable mode to allow designer to edit alert field
        if (!this.editableMode) {
            $('.js_subscribe > .alert').addClass("hidden");
            $('.js_subscribe > .input-group-btn.hidden').removeClass("hidden");
            this.$target.find('.js_subscribe_btn').on('click', function (event) {
                event.preventDefault();
                self._onClick();
            });
        }
    },
    _onClick: function () {
        var self = this;
        var $email = this.$target.find(".js_subscribe_email:visible");

        if ($email.length && !$email.val().match(/.+@.+/)) {
            this.$target.addClass('has-error');
            return false;
        }
        this.$target.removeClass('has-error');

        this._rpc({
            route: '/website_mass_mailing/subscribe',
            params: {
                'list_id': this.$target.data('list-id'),
                'email': $email.length ? $email.val() : false,
            },
        }).then(function (subscribe) {
            self.$target.find(".js_subscribe_email, .input-group-btn").addClass("hidden");
            self.$target.find(".alert").removeClass("hidden");
            self.$target.find('input.js_subscribe_email').attr("disabled", subscribe ? "disabled" : false);
            self.$target.attr("data-subscribe", subscribe ? 'on' : 'off');
        });
    },
});

sAnimation.registry.newsletter_popup = sAnimation.Class.extend({
    selector: ".o_newsletter_popup",
    start: function () {
        var self = this;
        var popupcontent = self.$target.find(".o_popup_content_dev").empty();
        if (!self.$target.data('list-id')) return;

        this._rpc({
            route: '/website_mass_mailing/get_content',
            params: {
                newsletter_id: self.$target.data('list-id'),
            },
        }).then(function (data) {
            if (data.content) {
                $('<div></div>').append(data.content).appendTo(popupcontent);
            }
            self.$target.find('input.popup_subscribe_email').val(data.email || "");
            self.redirect_url = data.redirect_url;
            if (!self.editableMode && !data.is_subscriber) {
                $(document).on('mouseleave', _.bind(self.show_banner, self));

                self.$target.find('.popup_subscribe_btn').on('click', function (event) {
                    event.preventDefault();
                    self._onClickSubscribe();
                });
            } else { $(document).off('mouseleave'); }
        });
    },
    _onClickSubscribe: function () {
        var self = this;
        var $email = self.$target.find(".popup_subscribe_email:visible");

        if ($email.length && !$email.val().match(/.+@.+/)) {
            this.$target.addClass('has-error');
            return false;
        }
        this.$target.removeClass('has-error');

        this._rpc({
            route: '/website_mass_mailing/subscribe',
            params: {
                'list_id': self.$target.data('list-id'),
                'email': $email.length ? $email.val() : false,
            },
        }).then(function (subscribe) {
            self.$target.find('#o_newsletter_popup').modal('hide');
            $(document).off('mouseleave');
            if (self.redirect_url) {
                if (_.contains(self.redirect_url.split('/'), window.location.host) || self.redirect_url.indexOf('/') === 0) {
                    window.location.href = self.redirect_url;
                } else {
                    window.open(self.redirect_url, '_blank');
                }
            }
        });
    },
    show_banner: function () {
        var self = this;
        if (!utils.get_cookie("newsletter-popup-"+ self.$target.data('list-id')) && self.$target) {
           $('#o_newsletter_popup:first').modal('show').css({
                'margin-top': '70px',
                'position': 'fixed'
            });
             document.cookie = "newsletter-popup-"+ self.$target.data('list-id') +"=" + true + ";path=/";
        }
    }
});
});

//==============================================================================

odoo.define('mass_mailing.unsubscribe', function (require) {
'use strict';

var core = require('web.core');
var sAnimation = require('website.content.snippets.animation');

var _t = core._t;

sAnimation.registry.massMailingUnsubscribe = sAnimation.Class.extend({
    selector: "#unsubscribe_form",
    read_events: {
        'submit': '_onSubmit',
    },

    /**
     * @override
     */
    start: function () {
        this.$alert = this.$('.alert');
        this.$email = this.$('input[name="email"]');
        this.$contacts = this.$('input[name="contact_ids"]');
        this.$mailingID = this.$('input[name="mailing_id"]');

        return this._super.apply(this, arguments);
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Gets a filtered array of integer IDs of matching lists.
     *
     * @private
     * @param {boolean} [checked=false]
     * @return {integer[]}
     */
    _getContactIDs: function (checked) {
        var filter = checked ? ':checked' : ':not(:checked)';
        return _.map(this.$contacts.filter(filter), function (el) {
            return parseInt($(el).val(), 10);
        });
    },
    /**
     * Reads the form data which is needed to perform the unsubscription.
     *
     * @private
     * @returns {Object}
     */
    _getValues: function () {
        return {
            email: this.$email.val(),
            mailing_id: parseInt(this.$mailingID.val(), 10),
            opt_in_ids: this._getContactIDs(true),
            opt_out_ids: this._getContactIDs(false),
        };
    },
    /**
     * Calls the controller to perform the unsubscription.
     *
     * @private
     * @returns {Deferred}
     */
    _unsubscribe: function () {
        return this._rpc({
            route: this.$el.attr('action'),
            params: this._getValues(),
        }).then(this._onSuccess.bind(this), this._onFailure.bind(this));
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * Called the form is submitted -> Do the unsubscription.
     *
     * @private
     * @param {Event} ev
     */
    _onSubmit: function (ev) {
        ev.preventDefault();
        this._unsubscribe();
    },
    /**
     * Called when the unsubscription failed to be performed -> Changes the
     * message displayed to the user.
     *
     * @private
     */
    _onFailure: function () {
        this.$alert
        .html(_t("Your changes have not been saved, try again later."))
        .removeClass('alert-info alert-success')
        .addClass('alert-warning');
    },
    /**
     * Called when the unsubscription succeeded to be performed -> Changes the
     * message displayed to the user.
     *
     * @private
     */
    _onSuccess: function () {
        this.$alert
        .html(_t("Your changes have been saved."))
        .removeClass('alert-info alert-warning')
        .addClass('alert-success');
    },
});
});
