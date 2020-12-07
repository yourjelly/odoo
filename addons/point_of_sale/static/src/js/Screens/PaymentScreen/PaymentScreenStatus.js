odoo.define('point_of_sale.PaymentScreenStatus', function (require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');

    class PaymentScreenStatus extends PosComponent {
        get activeOrder() {
            return this.props.activeOrder;
        }
        get changeText() {
            const change = this.env.model.getOrderChange(this.activeOrder);
            return this.env.model.formatCurrency(change);
        }
        get totalDueText() {
            const totalAmountToPay = this.env.model.getTotalAmountToPay(this.activeOrder);
            return this.env.model.formatCurrency(totalAmountToPay);
        }
        get remainingText() {
            const remaining = this.env.model.getOrderDue(this.activeOrder);
            return this.env.model.formatCurrency(remaining);
        }
    }
    PaymentScreenStatus.template = 'PaymentScreenStatus';

    return PaymentScreenStatus;
});
