odoo.define('point_of_sale.ErrorPopup', function(require) {
    'use strict';

    const Chrome = require('point_of_sale.Chrome');
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

    Chrome.addComponents([ErrorPopup]);
    Registry.add('ErrorPopup', ErrorPopup);

    return ErrorPopup;
});
