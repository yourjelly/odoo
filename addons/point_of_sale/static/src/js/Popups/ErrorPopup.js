odoo.define('point_of_sale.ErrorPopup', function(require) {
    'use strict';

    const AbstractAwaitablePopup = require('point_of_sale.AbstractAwaitablePopup');
    const Registry = require('point_of_sale.ComponentsRegistry');

    // formerly ErrorPopupWidget
    class ErrorPopup extends AbstractAwaitablePopup {
        static template = 'ErrorPopup';
    }
    ErrorPopup.defaultProps = {
        confirmText: 'Ok',
        cancelText: 'Cancel',
        title: 'Error',
        body: '',
    };

    Registry.add(ErrorPopup);

    return ErrorPopup;
});
