odoo.define('point_of_sale.OrderManagementScreen', function (require) {
    'use strict';

    const { useContext } = owl.hooks;
    const { useListener } = require('web.custom_hooks');
    const ControlButtonsMixin = require('point_of_sale.ControlButtonsMixin');
    const NumberBuffer = require('point_of_sale.NumberBuffer');
    const Registries = require('point_of_sale.Registries');
    const OrderFetcher = require('point_of_sale.OrderFetcher');
    const IndependentToOrderScreen = require('point_of_sale.IndependentToOrderScreen');

    class OrderManagementScreen extends ControlButtonsMixin(IndependentToOrderScreen) {
        constructor() {
            super(...arguments);
            useListener('close-screen', this.close);
            useListener('set-numpad-mode', this._setNumpadMode);
            useListener('select-line', this._updateNumberSelected);
            useListener('click-order', this._onClickOrder);
            useListener('next-page', this._onNextPage);
            useListener('prev-page', this._onPrevPage);
            useListener('search', this._onSearch);
            NumberBuffer.use({
                nonKeyboardInputEvent: 'numpad-click-input',
                useWithBarcode: true,
            });
            this.numpadMode = 'quantity';
            OrderFetcher.setComponent(this);
            this.orderManagementContext = useContext(this.env.orderManagement);
        }
        mounted() {
            OrderFetcher.on('update', this, this.render);
            this.env.pos.get('orders').on('add remove', this.render, this);

            // calculate how many can fit in the screen.
            // It is based on the height of the header element.
            // So the result is only accurate if each row is just single line.
            const flexContainer = this.el.querySelector('.flex-container');
            const cpEl = this.el.querySelector('.control-panel');
            const headerEl = this.el.querySelector('.order-row.header');
            const val = Math.trunc(
                (flexContainer.offsetHeight - cpEl.offsetHeight - headerEl.offsetHeight) / headerEl.offsetHeight
            );
            OrderFetcher.setNPerPage(val);

            // Fetch the order after mounting so that order management screen
            // is shown while fetching.
            setTimeout(() => OrderFetcher.fetch(), 0);
        }
        willUnmount() {
            OrderFetcher.off('update', this);
            this.env.pos.get('orders').off('add remove', null, this);
        }
        get selectedClient() {
            const order = this.orderManagementContext.selectedOrder;
            return order ? order.get_client() : null;
        }
        get orders() {
            return OrderFetcher.get();
        }
        async _setNumpadMode(event) {
            const { mode } = event.detail;
            this.numpadMode = mode;
            NumberBuffer.reset();
        }
        _onNextPage() {
            OrderFetcher.nextPage();
        }
        _onPrevPage() {
            OrderFetcher.prevPage();
        }
        _onSearch({ detail: domain }) {
            OrderFetcher.setSearchDomain(domain);
            OrderFetcher.setPage(1);
            OrderFetcher.fetch();
        }
        _onClickOrder({ detail: clickedOrder }) {
            if (!clickedOrder || clickedOrder.locked) {
                this.orderManagementContext.selectedOrder = clickedOrder;
                this._updateNumberSelected();
            } else {
                this._setOrder(clickedOrder);
            }
        }
        /**
         * @param {models.Order} order
         */
        _setOrder(order) {
            if (order === this.env.pos.get_order()) {
                this.close();
            } else {
                this.env.pos.set_order(order);
            }
        }
        _updateNumberSelected() {
            const orderlines = this.orderManagementContext.selectedOrder
                ? this.orderManagementContext.selectedOrder.orderlines
                : [];
            this.orderManagementContext.numberSelectedLines = orderlines.filter((line) => line.selected).length;
        }
    }
    OrderManagementScreen.template = 'OrderManagementScreen';
    OrderManagementScreen.hideOrderSelector = true;

    Registries.Component.add(OrderManagementScreen);

    return OrderManagementScreen;
});
