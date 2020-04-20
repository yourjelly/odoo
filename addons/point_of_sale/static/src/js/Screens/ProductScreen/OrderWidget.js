odoo.define('point_of_sale.OrderWidget', function(require) {
    'use strict';

    const { useState, useRef, onPatched } = owl.hooks;
    const { useListener } = require('web.custom_hooks');
    const PosComponent = require('point_of_sale.PosComponent');
    const Registries = require('point_of_sale.Registries');

    class OrderWidget extends PosComponent {
        constructor() {
            super(...arguments);
            useListener('select-line', this._selectLine);
            useListener('edit-pack-lot-lines', this._editPackLotLines);
            this.scrollableRef = useRef('scrollable');
            this.scrollToBottom = false;
            onPatched(() => {
                // IMPROVEMENT
                // This one just stays at the bottom of the orderlines list.
                // Perhaps it is better to scroll to the added or modified orderline.
                if (this.scrollToBottom) {
                    this.scrollableRef.el.scrollTop = this.scrollableRef.el.scrollHeight;
                    this.scrollToBottom = false;
                }
            });
            this.state = useState({ total: 0, tax: 0 });
            this._updateSummary();
        }
        get order() {
            return this.env.pos.get_order();
        }
        get orderlinesArray() {
            return this.order ? this.order.get_orderlines() : [];
        }
        mounted() {
            this._startListeners(this.order);
        }
        willUnmount() {
            this._stopListeners(this._prevOrder);
        }
        _selectLine(event) {
            this.order.select_orderline(event.detail.orderline);
        }
        // TODO jcb: Might be better to lift this to ProductScreen
        // because there is similar operation when clicking a product.
        //
        // Furthermore, what if a number different from 1 (or -1) is specified
        // to an orderline that has product tracked by lot. Lot tracking (based
        // on the current implementation) requires that 1 item per orderline is
        // allowed.
        async _editPackLotLines(event) {
            const orderline = event.detail.orderline;
            const isAllowOnlyOneLot = orderline.product.isAllowOnlyOneLot();
            const packLotLinesToEdit = orderline.getPackLotLinesToEdit(isAllowOnlyOneLot);
            const { confirmed, payload } = await this.showPopup('EditListPopup', {
                title: this.env._t('Lot/Serial Number(s) Required'),
                isSingleItem: isAllowOnlyOneLot,
                array: packLotLinesToEdit,
            });
            if (confirmed) {
                // Segregate the old and new packlot lines
                const modifiedPackLotLines = Object.fromEntries(
                    payload.newArray.filter(item => item.id).map(item => [item.id, item.text])
                );
                const newPackLotLines = payload.newArray
                    .filter(item => !item.id)
                    .map(item => ({ lot_name: item.text }));

                orderline.setPackLotLines({ modifiedPackLotLines, newPackLotLines });
            }
            this.order.select_orderline(event.detail.orderline);
        }
        _startListeners(order) {
            // set _prevOrder so that when order is changed,
            // we can stop the listeners on it.
            this._prevOrder = order;
            this.env.pos.on(
                'change:selectedOrder',
                this._onChangeSelectedOrder,
                this
            );
            if (order) {
                order.orderlines.on(
                    'new-orderline-selected',
                    () => this.trigger('new-orderline-selected'),
                    this
                );
                order.orderlines.on('change', this._updateSummary, this);
                order.orderlines.on(
                    'add remove',
                    async () => {
                        this.scrollToBottom = true;
                        this._updateSummary();
                        await this.render();
                    },
                    this
                );
                order.on('change', this.render, this);
            }
        }
        _stopListeners(order) {
            this.env.pos.off('change:selectedOrder', null, this);
            if (order) {
                order.orderlines.off('new-orderline-selected', null, this);
                order.orderlines.off('change', null, this);
                order.orderlines.off('add remove', null, this);
                order.off('change', null, this);
            }
        }
        _onChangeSelectedOrder(pos, newSelectedOrder) {
            this._stopListeners(this._prevOrder);
            this._startListeners(newSelectedOrder);
            this._updateSummary();
            this.trigger('new-orderline-selected');
        }
        _updateSummary() {
            const total = this.order ? this.order.get_total_with_tax() : 0;
            const tax = this.order ? total - this.order.get_total_without_tax() : 0;
            this.state.total = this.env.pos.format_currency(total);
            this.state.tax = this.env.pos.format_currency(tax);
        }
    }
    OrderWidget.template = 'OrderWidget';

    Registries.Component.add(OrderWidget);

    return OrderWidget;
});
