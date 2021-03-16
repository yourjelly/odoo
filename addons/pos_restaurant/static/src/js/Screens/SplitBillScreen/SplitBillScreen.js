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
        }
        async onProceed() {
            if (this._hasEmptySplit()) {
                this.env.ui.showNotification(this.env._t('Nothing to split.'));
            } else {
                await this.env.actionHandler({
                    name: 'actionSplitOrder',
                    args: [this.props.activeOrder, this.splitlines, this.props.disallow],
                });
            }
        }
        _onClickLine(event) {
            this._splitQuantity(event.detail);
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
