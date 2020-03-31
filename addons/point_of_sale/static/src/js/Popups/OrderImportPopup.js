odoo.define('point_of_sale.OrderImportPopup', function(require) {
    'use strict';

    const Chrome = require('point_of_sale.Chrome');
    const AbstractAwaitablePopup = require('point_of_sale.AbstractAwaitablePopup');
    const Registry = require('point_of_sale.ComponentsRegistry');

    // formerly OrderImportPopupWidget
    class OrderImportPopup extends AbstractAwaitablePopup {
        static template = 'OrderImportPopup';
        get unpaidSkipped() {
            return (
                (this.props.report.unpaid_skipped_existing || 0) +
                (this.props.report.unpaid_skipped_session || 0)
            );
        }
        getPayload() {}
    }
    OrderImportPopup.defaultProps = {
        confirmText: 'Ok',
        cancelText: 'Cancel',
        body: '',
    };

    Chrome.addComponents([OrderImportPopup]);
    Registry.add('OrderImportPopup', OrderImportPopup);

    return OrderImportPopup;
});
