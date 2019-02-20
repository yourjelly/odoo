odoo.define('website_slides.website_slides', function (require) {
'use strict';

var WebsiteProfile = require('website_profile.website_profile');

WebsiteProfile.include({
    _get_validation_email_params: function ($element) {
        return ['elearning']
    }
});

});
