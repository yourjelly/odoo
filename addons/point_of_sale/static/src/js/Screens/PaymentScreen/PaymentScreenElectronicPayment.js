odoo.define('point_of_sale.PaymentScreenElectronicPayment', function (require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const Registries = require('point_of_sale.Registries');

    class PaymentScreenElectronicPayment extends PosComponent {
        static template = 'PaymentScreenElectronicPayment';
        mounted() {
            this.props.line.on('change', this.render, this);
        }
        willUnmount() {
            if (this.props.line) {
                // It could be that the line is deleted before unmounting the element.
                this.props.line.off('change', null, this);
            }
        }
    }

    Registries.Component.add(PaymentScreenElectronicPayment);

    return PaymentScreenElectronicPayment;
});
