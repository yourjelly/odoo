odoo.define('website_profile.website_profile', function (require) {
'use strict';

var sAnimations = require('website.content.snippets.animation');

sAnimations.registry.websiteProfile = sAnimations.Class.extend({
    selector: '.o_wprofile_email_validation_container',
    read_events: {
        'click .send_validation_email': '_onSendValidationEmailClick',
        'click .validated_email_close': '_onCloseValidatedEmailClick',
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------
    _get_validation_email_params: function ($element) {
        return []
    },

    /**
     * @private
     * @param {Event} ev
     */
    _onSendValidationEmailClick: function (ev) {
        ev.preventDefault();
        var self = this;
        var $element = $(ev.currentTarget);
        var params = {};
        var paramsAttributes = this._get_validation_email_params();
        for(var i = 0; i < paramsAttributes.length; i++) {
            var paramsAttribute = paramsAttributes[i];
            params[paramsAttribute] = $element.data(paramsAttribute);
        }
        this._rpc({
            route: '/profile/send_validation_email',
            params: params,
        }).then(function (data) {
            if (data) {
                self.$('button.validation_email_close').click();
            }
        });
    },

    /**
     * @private
     */
    _onCloseValidatedEmailClick: function () {
        this._rpc({
            route: '/profile/validate_email/close',
        });
    },
});

return sAnimations.registry.websiteProfile;

});
