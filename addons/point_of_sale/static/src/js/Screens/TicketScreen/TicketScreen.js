odoo.define('point_of_sale.TicketScreen', function (require) {
    'use strict';

    const { Order } = require('point_of_sale.models');
    const Registries = require('point_of_sale.Registries');
    const PosComponent = require('point_of_sale.PosComponent');
    const NumberBuffer = require('point_of_sale.NumberBuffer');
    const { useListener } = require("@web/core/utils/hooks");
    const { parse } = require('web.field_utils');

    const { onMounted, onWillUnmount, useState } = owl;

    const ORDER_STATE = {
        ACTIVE_ORDERS: 'ACTIVE_ORDERS',
        ONGOING: 'ONGOING',
        PAYMENT: 'PAYMENT',
        RECEIPT: 'RECEIPT',
        SYNCED: 'SYNCED',
    }

    class TicketScreen extends PosComponent {
        setup() {
            super.setup();
            // useListener('close-screen', this.onCloseScreen);
            // useListener('filter-selected', this._onFilterSelected);
            // useListener('search', this._onSearch);
            // useListener('click-order', this._onClickOrder);
            // useListener('create-new-order', this._onCreateNewOrder);
            // useListener('delete-order', this.onDeleteOrder);
            // useListener('next-page', this._onNextPage);
            // useListener('prev-page', this._onPrevPage);
            // useListener('order-invoiced', this._onInvoiceOrder);
            useListener('click-order-line', this._onClickOrderline);
            useListener('click-refund-order-uid', this._onClickRefundOrderUid);
            useListener('update-selected-orderline', this._onUpdateSelectedOrderline);
            useListener('do-refund', this._onDoRefund);
            NumberBuffer.use({
                nonKeyboardInputEvent: 'numpad-click-input',
                triggerAtInput: 'update-selected-orderline',
            });
            this._state = this.env.pos.TICKET_SCREEN_STATE;
            this.state = useState({
                showSearchBar: !this.env.isMobile,
                selectedOrder: this.env.pos.get_order(),
                selectedFilter: this.props.selectedFilter || ORDER_STATE['ACTIVE_ORDERS'],
                selectedOrderlineId: null,
                currentPage: 1,
                totalCount: null,
                ordersToShow: this._getOrderList(),
            });
            this.ORDER_PER_PAGE = 3; //80

            const defaultUIState = this.props.reuseSavedUIState
                ? this._state.ui
                : {
                      selectedSyncedOrderId: null,
                      searchDetails: this.env.pos.getDefaultSearchDetails(),
                      filter: null,
                      selectedOrderlineIds: {},
                  };
            Object.assign(this._state.ui, defaultUIState, this.props.ui || {});

            onMounted(this.onMounted);
            onWillUnmount(this.onWillUnmount);
        }
        //#region LIFECYCLE METHODS
        onMounted() {
            this.env.posbus.on('ticket-button-clicked', this, this.close);
            // setTimeout(() => {
            //     // Show updated list of synced orders when going back to the screen.
            //     this.onFilterSelect(this.state.selectedFilter);
            // });
        }
        onWillUnmount() {
            this.env.posbus.off('ticket-button-clicked', this);
        }
        //#endregion
        //#region EVENT HANDLERS
        // onCloseScreen() {
        //     this.close();
        // }
        async onFilterSelect(filter) {
            if (this.state.selectedFilter !== filter) {
                if (this.state.selectedFilter !== ORDER_STATE['SYNCED'] && filter === ORDER_STATE['SYNCED']) {
                    this.state.selectedOrder = null;
                } else {
                    this.state.selectedOrder = this.env.pos.get_order();
                }
                this.state.selectedFilter = filter;
                await this._updateOrdersToShow();
            }
        }
        async onSearch(fieldName, searchTerm) {
            Object.assign(this._state.ui.searchDetails, { fieldName, searchTerm });
            await this._updateOrdersToShow();
        }

        async _updateOrdersToShow() {
            if (this.state.selectedFilter == ORDER_STATE['SYNCED']) {
                this.state.currentPage = 1;
                await this._fetchSyncedOrders();
            } else {
                this.state.ordersToShow = this._getOrderList().filter(order => this._checkOrderFilter(order) && this._checkOrderSearch(order));
            }
        }

        _getOrderByUid(uid) {
            return this.state.ordersToShow.find(order => order.uid === uid);
        }
        // _getSelectedOrderIds() {
        //     return { serverId: this.state.selectedOrder.server_id, uid: this.state.selectedOrder.uid };
        // }
        onClickOrderDetails(clickedOrderDetails) {
            if (clickedOrderDetails.locked) { // paid order
                if (this.state.selectedOrder && this.state.selectedOrder.uid == clickedOrderDetails.uid) {
                    this.state.selectedOrder = null;
                    this.selectOrderlineId = null;
                } else {
                    this.state.selectedOrder = this._getOrderByUid(clickedOrderDetails.uid);
                    // Automatically select the first orderline of the selected order.
                    const firstLine = this.state.selectedOrder.get_orderlines()[0];
                    if (firstLine) {
                        this.state.selectedOrderlineId = firstLine.id;
                    }
                }
                NumberBuffer.reset();
            } else {
                const order = this.env.pos.get_order_list().find(o => o.uid === clickedOrderDetails['uid']);
                this._setOrder(order);
            }
        }
        _onCreateNewOrder() {
            this.env.pos.add_new_order();
            this.showScreen('ProductScreen');
        }
        _selectNextOrder(currentOrder) {
            const currentOrderIndex = this._getOrderList().indexOf(currentOrder);
            const orderList = this._getOrderList();
            this.env.pos.set_order(orderList[currentOrderIndex+1] || orderList[currentOrderIndex-1]);
        }
        async onDeleteOrder(orderUid) {
            const order = this.env.pos.get_order_list().find(o => o.uid === orderUid);
            const screen = order.get_screen_data();
            if (['ProductScreen', 'PaymentScreen'].includes(screen.name) && order.get_orderlines().length > 0) {
                const { confirmed } = await this.showPopup('ConfirmPopup', {
                    title: this.env._t('Existing orderlines'),
                    body: _.str.sprintf(
                      this.env._t('%s has a total amount of %s, are you sure you want to delete this order ?'),
                      order.name, this.env.pos.format_currency(order.get_total_with_tax())
                    ),
                });
                if (!confirmed) return;
            }
            if (order && (await this._onBeforeDeleteOrder(order))) {
                if (order === this.env.pos.get_order()) {
                    this._selectNextOrder(order);
                }
                this.env.pos.removeOrder(order);
            }
        }
        async _onNextPage() {
            if (this.state.currentPage < this._getLastPage()) {
                this.state.currentPage += 1;
                await this._fetchSyncedOrders();
            }
        }
        async _onPrevPage() {
            if (this.state.currentPage > 1) {
                this.state.currentPage -= 1;
                await this._fetchSyncedOrders();
            }
        }
        async onInvoiceOrder() {
            this.state.ordersToShow = [];
            await this._fetchSyncedOrders();
            this.state.selectedOrder = this.state.ordersToShow.find(order => order.uid === this.state.selectedOrder.uid)
        }
        _onClickOrderline({ detail: orderline }) {
            this.state.selectedOrderlineId = orderline.id;
            NumberBuffer.reset();
        }
        _onClickRefundOrderUid({ detail: orderUid }) {
            // Open the refund order.
            const refundOrder = this.env.pos.orders.find((order) => order.uid == orderUid);
            if (refundOrder) {
                this._setOrder(refundOrder);
            }
        }
        _onUpdateSelectedOrderline({ detail }) {
            const buffer = detail.buffer;
            const order = this.getSelectedSyncedOrder();
            if (!order) return NumberBuffer.reset();

            const orderline = order.orderlines.find((line) => line.id == this.state.selectedOrderlineId);
            if (!orderline) return NumberBuffer.reset();

            const toRefundDetail = this._getToRefundDetail(orderline);
            // When already linked to an order, do not modify the to refund quantity.
            if (toRefundDetail.destinationOrderUid) return NumberBuffer.reset();

            const refundableQty = toRefundDetail.orderline.qty - toRefundDetail.orderline.refundedQty;
            if (refundableQty <= 0) return NumberBuffer.reset();

            if (buffer == null || buffer == '') {
                toRefundDetail.qty = 0;
            } else {
                const quantity = Math.abs(parse.float(buffer));
                if (quantity > refundableQty) {
                    NumberBuffer.reset();
                    this.showPopup('ErrorPopup', {
                        title: this.env._t('Maximum Exceeded'),
                        body: _.str.sprintf(
                            this.env._t(
                                'The requested quantity to be refunded is higher than the ordered quantity. %s is requested while only %s can be refunded.'
                            ),
                            quantity,
                            refundableQty
                        ),
                    });
                } else {
                    toRefundDetail.qty = quantity;
                }
            }
        }
        async _onDoRefund() {
            const order = this.getSelectedSyncedOrder();
            if (!order) {
                this._state.ui.highlightHeaderNote = !this._state.ui.highlightHeaderNote;
                return;
            }

            if (this._doesOrderHaveSoleItem(order)) {
                this._prepareAutoRefundOnOrder(order);
            }

            const partner = order.get_partner();

            const allToRefundDetails = this._getRefundableDetails(partner);
            if (allToRefundDetails.length == 0) {
                this._state.ui.highlightHeaderNote = !this._state.ui.highlightHeaderNote;
                return;
            }

            // The order that will contain the refund orderlines.
            // Use the destinationOrder from props if the order to refund has the same
            // partner as the destinationOrder.
            const destinationOrder =
                this.props.destinationOrder && partner === this.props.destinationOrder.get_partner()
                    ? this.props.destinationOrder
                    : this.env.pos.add_new_order();

            // Add orderline for each toRefundDetail to the destinationOrder.
            for (const refundDetail of allToRefundDetails) {
                const product = this.env.pos.db.get_product_by_id(refundDetail.orderline.productId);
                const options = this._prepareRefundOrderlineOptions(refundDetail);
                await destinationOrder.add_product(product, options);
                refundDetail.destinationOrderUid = destinationOrder.uid;
            }

            // Set the partner to the destinationOrder.
            if (partner && !destinationOrder.get_partner()) {
                destinationOrder.set_partner(partner);
                destinationOrder.updatePricelist(partner);
            }

            this.onCloseScreen();
        }
        _showCardholderName() {
            return this.env.pos.payment_methods.some((method) => method.use_payment_terminal);
        }
        _getStatus(order) {
            if (order.locked) {
                return this.env._t('Paid');
            } else {
                const screen = order.get_screen_data();
                return this._getOrderStates().get(this._getScreenToStatusMap()[screen.name]).text;
            }
        }
        /**
         * Hide the delete button if one of the payments is a 'done' electronic payment.
         */
        _isOrderDeletable(order) {
            return (
                !order.locked &&
                !order
                    .get_paymentlines()
                    .some((payment) => payment.is_electronic() && payment.get_payment_status() === 'done')
            );
        }
        //#endregion
        //#region PUBLIC METHODS
        getSelectedSyncedOrder() {
            if (this.state.selectedFilter == ORDER_STATE['SYNCED']) {
                return this.state.selectedOrder;
            } else {
                return null;
            }
        }
        // getSelectedOrderlineId() {
        //     return this._state.ui.selectedOrderlineIds[this._state.ui.selectedSyncedOrderId];
        // }
        /**
         * Override to conditionally show the new ticket button.
         */
        shouldShowNewOrderButton() {
            return true;
        }
        // only check local order
        _checkOrderFilter(order) {
            if (this.state.selectedFilter !== ORDER_STATE['ACTIVE_ORDERS']) {
                const screen = order.get_screen_data();
                return this.state.selectedFilter === this._getScreenToStatusMap()[screen.name];
            }
            return true;
        }
        _checkOrderSearch(order) {
            const { fieldName, searchTerm } = this._state.ui.searchDetails;
            if (!searchTerm) {
                return true;
            }
            const searchField = this._getSearchFields()[fieldName];
            const repr = searchField.repr(order);
            return repr && repr.toString().toLowerCase().includes(searchTerm.toLowerCase());
        }
        _getFormattedOrders() {
            return this.state.ordersToShow.map(order => {
                return {
                    date: moment(order.validation_date).format('YYYY-MM-DD hh:mm A'),
                    name: order.name,
                    partner: order.get_partner_name(),
                    cardholderName: order.get_cardholder_name(),
                    cashier: order.cashier ? order.cashier.name : '',
                    total: this.env.pos.format_currency(order.get_total_with_tax()),
                    status: this._getStatus(order),
                    deletable: this._isOrderDeletable(order),
                    uid: order.uid,
                    locked: order.locked,
                    serverId: order.server_id,
                }
            })
        }
        getSearchBarConfig() {
            return {
                searchFields: new Map(
                    Object.entries(this._getSearchFields()).map(([key, val]) => [key, val.displayName])
                ),
                filter: { show: true, options: this._getFilterOptions() },
                defaultSearchDetails: this._state.ui.searchDetails,
                defaultFilter: this.state.selectedFilter,
            };
        }
        shouldShowPageControls() {
            return this.state.selectedFilter == ORDER_STATE['SYNCED'] && this._getLastPage() > 1;
        }
        getPageNumber() {
            if (!this.state.totalCount) {
                return `1/1`;
            } else {
                return `${this.state.currentPage}/${this._getLastPage()}`;
            }
        }
        getSelectedPartner() {
            const order = this.getSelectedSyncedOrder();
            return order ? order.get_partner() : null;
        }
        getHasItemsToRefund() {
            const order = this.getSelectedSyncedOrder();
            if (!order) return false;
            if (this._doesOrderHaveSoleItem(order)) return true;
            const total = Object.values(this.env.pos.toRefundLines)
                .filter(
                    (toRefundDetail) =>
                        toRefundDetail.orderline.orderUid === order.uid && !toRefundDetail.destinationOrderUid
                )
                .map((toRefundDetail) => toRefundDetail.qty)
                .reduce((acc, val) => acc + val, 0);
            return !this.env.pos.isProductQtyZero(total);
        }
        //#endregion
        //#region PRIVATE METHODS
        _doesOrderHaveSoleItem(order) {
            const orderlines = order.get_orderlines();
            if (orderlines.length !== 1) return false;
            const theOrderline = orderlines[0];
            const refundableQty = theOrderline.get_quantity() - theOrderline.refunded_qty;
            return this.env.pos.isProductQtyZero(refundableQty - 1);
        }
        _prepareAutoRefundOnOrder(order) {
            const orderline = order.orderlines.find((line) => line.id == this.state.selectedOrderlineId);
            if (!orderline) return;

            const toRefundDetail = this._getToRefundDetail(orderline);
            const refundableQty = orderline.get_quantity() - orderline.refunded_qty;
            if (this.env.pos.isProductQtyZero(refundableQty - 1)) {
                toRefundDetail.qty = 1;
            }
        }
        /**
         * Returns the corresponding toRefundDetail of the given orderline.
         * SIDE-EFFECT: Automatically creates a toRefundDetail object for
         * the given orderline if it doesn't exist and returns it.
         * @param {models.Orderline} orderline
         * @returns
         */
        _getToRefundDetail(orderline) {
            if (orderline.id in this.env.pos.toRefundLines) {
                return this.env.pos.toRefundLines[orderline.id];
            } else {
                const partner = orderline.order.get_partner();
                const orderPartnerId = partner ? partner.id : false;
                const newToRefundDetail = {
                    qty: 0,
                    orderline: {
                        id: orderline.id,
                        productId: orderline.product.id,
                        price: orderline.price,
                        qty: orderline.quantity,
                        refundedQty: orderline.refunded_qty,
                        orderUid: orderline.order.uid,
                        orderBackendId: orderline.order.server_id,
                        orderPartnerId,
                        tax_ids: orderline.get_taxes().map(tax => tax.id),
                        discount: orderline.discount,
                    },
                    destinationOrderUid: false,
                };
                this.env.pos.toRefundLines[orderline.id] = newToRefundDetail;
                return newToRefundDetail;
            }
        }
        /**
         * Select the lines from toRefundLines, as they can come from different orders.
         * Returns only details that:
         * - The quantity to refund is not zero
         * - Filtered by partner (optional)
         * - It's not yet linked to an active order (no destinationOrderUid)
         *
         * @param {Object} partner (optional)
         * @returns {Array} refundableDetails
         */
        _getRefundableDetails(partner) {
            return Object.values(this.env.pos.toRefundLines).filter(
                ({ qty, orderline, destinationOrderUid }) =>
                    !this.env.pos.isProductQtyZero(qty) &&
                    (partner ? orderline.orderPartnerId == partner.id : true) &&
                    !destinationOrderUid
            );
        }
        /**
         * Prepares the options to add a refund orderline.
         *
         * @param {Object} toRefundDetail
         * @returns {Object}
         */
        _prepareRefundOrderlineOptions(toRefundDetail) {
            const { qty, orderline } = toRefundDetail;
            return {
                quantity: -qty,
                price: orderline.price,
                extras: { price_manually_set: true },
                merge: false,
                refunded_orderline_id: orderline.id,
                tax_ids: orderline.tax_ids,
                discount: orderline.discount,
            }
        }
        _setOrder(order) {
            this.env.pos.set_order(order);
            this.onCloseScreen();
        }
        _getOrderList() {
            return this.env.pos.get_order_list();
        }
        _getFilterOptions() {
            const orderStates = this._getOrderStates();
            orderStates.set(ORDER_STATE['SYNCED'], { text: this.env._t('Paid') });
            return orderStates;
        }
        /**
         * @returns {Record<string, { repr: (order: models.Order) => string, displayName: string, modelField: string }>}
         */
        _getSearchFields() {
            const fields = {
                RECEIPT_NUMBER: {
                    repr: (order) => order.name,
                    displayName: this.env._t('Receipt Number'),
                    modelField: 'pos_reference',
                },
                DATE: {
                    repr: (order) => moment(order.creation_date).format('YYYY-MM-DD hh:mm A'),
                    displayName: this.env._t('Date'),
                    modelField: 'date_order',
                },
                PARTNER: {
                    repr: (order) => order.get_partner_name(),
                    displayName: this.env._t('Customer'),
                    modelField: 'partner_id.display_name',
                },
            };

            if (this._showCardholderName()) {
                fields.CARDHOLDER_NAME = {
                    repr: (order) => order.get_cardholder_name(),
                    displayName: this.env._t('Cardholder Name'),
                    modelField: 'payment_ids.cardholder_name',
                };
            }

            return fields;
        }
        /**
         * Maps the order screen params to order status.
         */
        _getScreenToStatusMap() {
            return {
                ProductScreen: ORDER_STATE['ONGOING'],
                PaymentScreen: ORDER_STATE['PAYMENT'],
                ReceiptScreen: ORDER_STATE['RECEIPT'],
            };
        }
        /**
         * Override to do something before deleting the order.
         * Make sure to return true to proceed on deleting the order.
         * @param {*} order
         * @returns {boolean}
         */
        async _onBeforeDeleteOrder(order) {
            return true;
        }
        _getOrderStates() {
            // We need the items to be ordered, therefore, Map is used instead of normal object.
            const states = new Map();
            states.set(ORDER_STATE['ACTIVE_ORDERS'], {
                text: this.env._t('All active orders'),
            });
            // The spaces are important to make sure the following states
            // are under the category of `All active orders`.
            states.set(ORDER_STATE['ONGOING'], {
                text: this.env._t('Ongoing'),
                indented: true,
            });
            states.set(ORDER_STATE['PAYMENT'], {
                text: this.env._t('Payment'),
                indented: true,
            });
            states.set(ORDER_STATE['RECEIPT'], {
                text: this.env._t('Receipt'),
                indented: true,
            });
            return states;
        }
        //#region SEARCH SYNCED ORDERS
        _computeSyncedOrdersDomain() {
            const { fieldName, searchTerm } = this._state.ui.searchDetails;
            if (!searchTerm) return [];
            const modelField = this._getSearchFields()[fieldName].modelField;
            if (modelField) {
                return [[modelField, 'ilike', `%${searchTerm}%`]];
            } else {
                return [];
            }
        }
        /**
         * Fetches the done orders from the backend that needs to be shown.
         * If the order is already in cache, the full information about that
         * order is not fetched anymore, instead, we use info from cache.
         */
        async _fetchSyncedOrders() {
            const domain = this._computeSyncedOrdersDomain();
            const offset = (this.state.currentPage - 1) * this.ORDER_PER_PAGE;
            const { orders, totalCount } = await this.rpc({
                model: 'pos.order',
                method: 'search_paid_order_ids',
                kwargs: { config_id: this.env.pos.config.id, limit: this.ORDER_PER_PAGE, domain, offset },
                context: this.env.session.user_context,
            });
            await this.env.pos._loadMissingProducts(orders);
            // const idsNotInCache = ids.filter((id) => !(id in this.env.pos.paidOrdersMap));
            // if (idsNotInCache.length > 0) {
            //     const fetchedOrdersData = await this.rpc({
            //         model: 'pos.order',
            //         method: 'export_for_ui',
            //         args: [idsNotInCache],
            //         context: this.env.session.user_context,
            //     });
                // Check for missing products and load them in the PoS
                // await this.env.pos._loadMissingProducts(fetchedOrdersData);
                // Cache these fetched orders so that next time, no need to fetch
                // them again, unless invalidated. See `_onInvoiceOrder`.
            //     fetchedOrdersData.forEach((order) => {
            //         this.env.pos.addPaidOrder(Order.create({}, { pos: this.env.pos, json: order }));
            //     });
            // }

            this.state.totalCount = totalCount;
            this.state.ordersToShow = orders.map(order => Order.create({}, { pos: this.env.pos, json: order }));
                // ids.map((id) => this.env.pos.getPaidOrderByServerId(id));
        }
        _getLastPage() {
            const remainder = this.state.totalCount % this.ORDER_PER_PAGE;
            if (remainder == 0) {
                return this.state.totalCount / this.ORDER_PER_PAGE;
            } else {
                return Math.ceil(this.state.totalCount / this.ORDER_PER_PAGE);
            }
        }
        onCloseScreen() {
            const order = this.env.pos.get_order();
            const { name: screenName } = order.get_screen_data();
            this.showScreen(screenName);
        }
    }
    TicketScreen.template = 'TicketScreen';
    TicketScreen.defaultProps = {
        destinationOrder: null,
        // When passed as true, it will use the saved _state.ui as default
        // value when this component is reinstantiated.
        // After setting the default value, the _state.ui will be overridden
        // by the passed props.ui if there is any.
        reuseSavedUIState: false,
        ui: {},
    };

    Registries.Component.add(TicketScreen);

    return TicketScreen;
});
