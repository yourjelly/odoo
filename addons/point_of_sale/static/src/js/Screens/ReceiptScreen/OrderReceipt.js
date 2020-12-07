odoo.define('point_of_sale.OrderReceipt', function (require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const { float_is_zero } = require('web.utils');

    class OrderReceipt extends PosComponent {
        _isTaxIncluded(receipt) {
            return float_is_zero(
                receipt.subtotal - receipt.total_with_tax,
                this.env.model.currency.decimal_places
            );
        }
        _isSimple(line) {
            return (
                line.discount === 0 &&
                line.unit_name === 'Units' &&
                line.quantity === 1 &&
                !(line.display_discount_policy == 'without_discount' && line.price != line.price_lst)
            );
        }
    }
    OrderReceipt.template = 'OrderReceipt';

    return OrderReceipt;
});
