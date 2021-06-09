odoo.define('point_of_sale.DiscountPopup', function (require) {
    'use strict';

    const NumberPopup = require('point_of_sale.NumberPopup');
    const Registries = require('point_of_sale.Registries');
    const NumberBuffer = require('point_of_sale.NumberBuffer');

    const DiscountPopup = (NumberPopup) => {
        class DiscountPopup extends NumberPopup {
            confirmPercent() {
                this.type = 'percent';
                this.confirm();
            }
            confirmAmount() {
                this.type = 'amount';
                this.confirm();
            }
            getPayload() {
                return { type: this.type, value: NumberBuffer.get() };
            }
        }
        DiscountPopup.template = 'point_of_sale.DiscountPopup';
        DiscountPopup.defaultProps = {
            percentText: '%',
            amountText: '$',
            title: 'Confirm ?',
            body: '',
            cheap: false,
            startingValue: null,
            isPassword: false,
        };
        return DiscountPopup;
    };

    Registries.Component.addByExtending(DiscountPopup, NumberPopup);

    return DiscountPopup;
});
