odoo.define('point_of_sale.ConfirmPopup', function(require) {
    'use strict';

    const Chrome = require('point_of_sale.Chrome');
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

    Chrome.addComponents([ConfirmPopup]);
    Registry.add('ConfirmPopup', ConfirmPopup);

    return ConfirmPopup;
});
