/** @odoo-module **/

import PosComponent from 'point_of_sale.PosComponent';
import Registries from 'point_of_sale.Registries';
const { useState } = owl;

export class OrderList extends PosComponent {
    static props = [
        'orders', 'showCardholderName', 'closeTicketScreen', 'selectedOrderUid', 'onClickOrderDetails',
        'onDeleteOrder',
    ]

    _isOrderSelected(order) {
        return order.uid === this.props.selectedOrderUid;
    }
};
OrderList.template = 'OrderList';

Registries.Component.add(OrderList);