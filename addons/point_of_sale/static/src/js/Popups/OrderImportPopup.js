odoo.define('point_of_sale.OrderImportPopup', function(require) {
    'use strict';

    const Draggable = require('point_of_sale.Draggable');

    class OrderImportPopup extends owl.Component {
        static components = { Draggable };
        get unpaidSkipped() {
            return (
                (this.props.report.unpaid_skipped_existing || 0) +
                (this.props.report.unpaid_skipped_session || 0)
            );
        }
    }
    OrderImportPopup.template = 'OrderImportPopup';
    OrderImportPopup.defaultProps = {
        confirmText: 'Ok',
        cancelText: 'Cancel',
        body: '',
    };

    return OrderImportPopup;
});
