odoo.define('point_of_sale.ErrorPopup', function (require) {
    'use strict';

    const Draggable = require('point_of_sale.Draggable');

    class ErrorPopup extends owl.Component {
        mounted() {
            this.env.ui.playSound('error');
        }
    }
    ErrorPopup.components = { Draggable };
    ErrorPopup.template = 'ErrorPopup';
    ErrorPopup.defaultProps = {
        confirmText: 'Ok',
        cancelText: 'Cancel',
        title: 'Error',
        body: '',
    };

    return ErrorPopup;
});
