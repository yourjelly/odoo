odoo.define('pos_restaurant.AbstractOrderManagementScreen', function (require) {
    'use strict';

    const AbstractOrderManagementScreen = require('point_of_sale.AbstractOrderManagementScreen');
    const { patch } = require('web.utils');

    return patch(AbstractOrderManagementScreen.prototype, 'pos_restaurant', {
        async _onClickOrder(event) {
            const order = event.detail;
            if (this.env.model.ifaceFloorplan && order.table_id) {
                const table = this.env.model.getRecord('restaurant.table', order.table_id);
                await this.env.actionHandler({ name: 'actionSetTable', args: [table, order.id] });
            } else {
                await this._super(...arguments);
            }
        },
    });
});
