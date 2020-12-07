odoo.define('point_of_sale.ConfirmPopup', function(require) {
    'use strict';

    const Draggable = require('point_of_sale.Draggable');

    // formerly ConfirmPopupWidget
    class ConfirmPopup extends owl.Component {}
    ConfirmPopup.components = { Draggable }
    ConfirmPopup.template = 'ConfirmPopup';
    ConfirmPopup.defaultProps = {
        confirmText: 'Ok',
        cancelText: 'Cancel',
        title: 'Confirm ?',
        body: '',
        hideCancel: false,
    };

    return ConfirmPopup;
});
