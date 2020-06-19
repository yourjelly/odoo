odoo.define('point_of_sale.ReturnButton', function (require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const OrderManagementScreen = require('point_of_sale.OrderManagementScreen');
    const Registries = require('point_of_sale.Registries');
    const models = require('point_of_sale.models');
    const { useListener } = require('web.custom_hooks');
    const { useContext } = owl.hooks;

    class ReturnButton extends PosComponent {
        constructor() {
            super(...arguments);
            useListener('click', this._onClick);
            this.orderManagementContext = useContext(this.env.orderManagement);
        }
        get selectedOrder() {
            return this.orderManagementContext.selectedOrder;
        }
        get numberSelectedLines() {
            return this.orderManagementContext.numberSelectedLines;
        }
        async _onClick() {
            // 1. create order with the correct lines
            const selectedOrderId = this.selectedOrder.backendId;
            const order =
                this.env.pos.get('orders').find((order) => order.originalOrderId === selectedOrderId) ||
                new models.Order({}, { pos: this.env.pos });
            if (!order.originalOrderId) {
                this.env.pos.get('orders').add(order);
                order.originalOrderId = selectedOrderId;
                let linesToReturn = this.selectedOrder.orderlines.filter((line) => line.selected);
                if (linesToReturn.length === 0) {
                    linesToReturn = this.selectedOrder.orderlines;
                }
                order.returnlines.add(
                    linesToReturn.map((line) => {
                        const clone = line.clone();
                        clone.is_return_line = true;
                        return clone;
                    })
                );
                const tempOrderlines = order.orderlines;
                // replace orderlines with the returnlines (to be able to use total amount compute methods)
                order.orderlines = order.returnlines;
                const totalAmount = order.get_total_with_tax();
                // put back the orderlines
                order.orderlines = tempOrderlines;
                order.add_product(this.env.pos.db.product_by_id[this.env.pos.config.return_product_id[0]], {
                    price: -totalAmount,
                });
            }
            // 2. set selected order
            this.env.pos.set('selectedOrder', order);
            // 3. close the screen
            this.trigger('close-screen');
        }
        get text() {
            return this.numberSelectedLines ? `Return Selected (${this.numberSelectedLines})` : 'Return';
        }
    }
    ReturnButton.template = 'ReturnButton';

    OrderManagementScreen.addControlButton({
        component: ReturnButton,
        condition: function () {
            return this.env.pos.config.module_account;
        },
    });

    Registries.Component.add(ReturnButton);

    return ReturnButton;
});
