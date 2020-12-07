odoo.define('pos_restaurant.SplitBillScreen', function (require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const SplitOrderline = require('pos_restaurant.SplitOrderline');
    const { useListener } = require('web.custom_hooks');
    const { useState } = owl.hooks;

    class SplitBillScreen extends PosComponent {
        static components = { SplitOrderline };
        constructor() {
            super(...arguments);
            useListener('click-line', this._onClickLine);
            this.splitlines = useState(this._initSplitLines(this.props.activeOrder));
            this.newOrder = this.env.model.cloneRecord('pos.order', this.props.activeOrder, {
                id: this.env.model._getNextId(),
                lines: [],
            });
            this.newOrder._extras.temporary = true;
            this._newOrderlines = {};
        }
        willUnmount() {
            if (this.newOrder && this.newOrder._extras.temporary) {
                this.env.actionHandler({ name: 'actionDeleteOrder', args: [this.newOrder] });
            }
        }
        async onProceed() {
            if (this._hasEmptySplit()) {
                this.env.ui.showNotification(this.env._t('Nothing to split.'));
            } else {
                await this.env.actionHandler({
                    name: 'actionSplitOrder',
                    args: [this.props.activeOrder, this.newOrder, this.splitlines, this.props.disallow],
                });
            }
        }
        _onClickLine(event) {
            const line = event.detail;
            this._splitQuantity(line);
            this._updateNewOrder(line);
        }
        /**
         * @param {models.Order} order
         * @returns {Object<{ quantity: number }>} splitlines
         */
        _initSplitLines(order) {
            const splitlines = {};
            for (const line of this.env.model.getOrderlines(order)) {
                splitlines[line.id] = { product: line.product_id, quantity: 0 };
            }
            return splitlines;
        }
        _splitQuantity(line) {
            const split = this.splitlines[line.id];

            let totalQuantity = 0;
            for (const orderline of this.env.model.getOrderlines(this.props.activeOrder)) {
                if (orderline.product_id === split.product) {
                    totalQuantity += orderline.qty;
                }
            }

            if (this.env.model.floatCompare(line.qty, 0) > 0) {
                const unit = this.env.model.getOrderlineUnit(line);
                if (!unit.is_pos_groupable) {
                    if (this.env.model.floatCompare(line.qty, split.quantity) !== 0) {
                        split.quantity = line.qty;
                    } else {
                        split.quantity = 0;
                    }
                } else {
                    if (split.quantity < totalQuantity) {
                        split.quantity += unit.is_pos_groupable ? 1 : unit.rounding;
                        if (this.env.model.floatCompare(split.quantity, line.qty) > 0) {
                            split.quantity = line.qty;
                        }
                    } else {
                        split.quantity = 0;
                    }
                }
            }
        }
        _updateNewOrder(line) {
            const split = this.splitlines[line.id];
            let orderline = this._newOrderlines[line.id];
            if (this.env.model.floatCompare(split.quantity, 0) > 0) {
                if (!orderline) {
                    orderline = this.env.model.cloneRecord('pos.order.line', line, {
                        id: this.env.model._getNextId(),
                    });
                    this._newOrderlines[line.id] = orderline;
                    this.env.model.addOrderline(this.newOrder, orderline);
                }
                this.env.model.updateRecord('pos.order.line', orderline.id, { qty: split.quantity });
            } else if (orderline) {
                this.env.model.actionDeleteOrderline(this.newOrder, orderline);
                this._newOrderlines[line.id] = null;
            }
        }
        _hasEmptySplit() {
            for (const lineId in this.splitlines) {
                const split = this.splitlines[lineId];
                if (this.env.model.floatCompare(split.quantity, 0, 5) !== 0) {
                    return false;
                }
            }
            return true;
        }
    }
    SplitBillScreen.template = 'SplitBillScreen';

    return SplitBillScreen;
});
