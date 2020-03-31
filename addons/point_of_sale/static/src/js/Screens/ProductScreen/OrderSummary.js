odoo.define('point_of_sale.OrderSummary', function(require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const OrderWidget = require('point_of_sale.OrderWidget');
    const Registry = require('point_of_sale.ComponentsRegistry');

    class OrderSummary extends PosComponent {
        static template = 'OrderSummary';
        constructor() {
            super(...arguments);
            this.order = this.props.order;
            this.update();
        }
        mounted() {
            this.order.orderlines.on('change', () => {
                this.update();
            });
        }
        update() {
            const total = this.order ? this.order.get_total_with_tax() : 0;
            const tax = this.order ? total - this.order.get_total_without_tax() : 0;
            this.total = this.env.pos.format_currency(total);
            this.tax = this.env.pos.format_currency(tax);
        }
    }

    OrderWidget.addComponents([OrderSummary]);
    Registry.add('OrderSummary', OrderSummary);

    return OrderSummary;
});
