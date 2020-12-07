odoo.define('pos_restaurant.Dialog', function (require) {
    'use strict';

    const Dialog = require('point_of_sale.Dialog');
    const TextAreaPopup = require('pos_restaurant.TextAreaPopup');
    const TextInputPopup = require('pos_restaurant.TextInputPopup');
    const { patch } = require('web.utils');

    return patch(Dialog, 'pos_restaurant', {
        components: { ...Dialog.components, TextAreaPopup, TextInputPopup },
    });
});
