odoo.define('point_of_sale.TextInputPopup', function(require) {
    'use strict';

    const TextAreaPopup = require('point_of_sale.TextAreaPopup');

    class TextInputPopup extends TextAreaPopup {}
    TextInputPopup.template = 'TextInputPopup';

    return TextInputPopup;
});
