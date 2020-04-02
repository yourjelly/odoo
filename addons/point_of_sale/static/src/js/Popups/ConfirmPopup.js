odoo.define('point_of_sale.ConfirmPopup', function(require) {
    'use strict';

    const AbstractAwaitablePopup = require('point_of_sale.AbstractAwaitablePopup');
    const Registry = require('point_of_sale.ComponentsRegistry');

    // formerly ConfirmPopupWidget
    class ConfirmPopup extends AbstractAwaitablePopup {
        static template = 'ConfirmPopup';
    }
    ConfirmPopup.defaultProps = {
        confirmText: 'Ok',
        cancelText: 'Cancel',
        title: 'Confirm ?',
        body: '',
    };

    Registry.add(ConfirmPopup);

    return ConfirmPopup;
});
