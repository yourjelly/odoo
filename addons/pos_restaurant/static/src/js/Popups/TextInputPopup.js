odoo.define('pos_restaurant.TextInputPopup', function(require) {
    'use strict';

    const TextAreaPopup = require('pos_restaurant.TextAreaPopup');

    class TextInputPopup extends TextAreaPopup {}
    TextInputPopup.template = 'TextInputPopup';

    return TextInputPopup;
});
