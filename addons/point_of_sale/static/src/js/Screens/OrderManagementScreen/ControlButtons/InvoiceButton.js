odoo.define('point_of_sale.InvoiceButton', function (require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const OrderManagementScreen = require('point_of_sale.OrderManagementScreen');
    const OrderFetcher = require('point_of_sale.OrderFetcher');
    const Registries = require('point_of_sale.Registries');
    const { useListener } = require('web.custom_hooks');
    const { useContext } = owl.hooks;

    class InvoiceButton extends PosComponent {
        constructor() {
            super(...arguments);
            useListener('click', this._onClick);
            this.orderManagementContext = useContext(this.env.orderManagement);
        }
        get selectedOrder() {
            return this.orderManagementContext.selectedOrder;
        }
        set selectedOrder(value) {
            this.orderManagementContext.selectedOrder = value;
        }
        async _downloadInvoice(orderIds) {
            try {
                await this.env.pos.do_action('point_of_sale.pos_invoice_report', {
                    additional_context: {
                        active_ids: orderIds,
                    },
                });
            } catch (error) {
                if (error instanceof Error) {
                    throw error;
                } else {
                    // NOTE: error here is most probably undefined
                    this.showPopup('ErrorPopup', {
                        title: this.env._t('Network Error'),
                        body: this.env._t('Unable to download invoice.'),
                    });
                }
            }
        }
        async _invoiceOrder() {
            const order = this.selectedOrder;
            if (!order) return;

            const orderIds = [order.backendId];

            // Part 0. If already invoiced, print the invoice.
            if (order.account_move) {
                await this._downloadInvoice(orderIds);
                return;
            }

            // Part 1: Handle missing client.
            // Write to pos.order the selected client.
            if (!order.get_client()) {
                const { confirmed: confirmedPopup } = await this.showPopup('ConfirmPopup', {
                    title: 'Need customer to invoice',
                    body: 'Do you want to open the customer list to select customer?',
                });
                if (!confirmedPopup) return;

                const {
                    confirmed: confirmedTempScreen,
                    payload: newClient,
                } = await this.showTempScreen('ClientListScreen');
                if (!confirmedTempScreen) return;

                await this.rpc({
                    model: 'pos.order',
                    method: 'write',
                    args: [orderIds, { partner_id: newClient.id }],
                    kwargs: { context: this.env.session.user_context },
                });
            }

            // Part 2: Invoice the order.
            await this.rpc(
                {
                    model: 'pos.order',
                    method: 'action_pos_order_invoice',
                    args: orderIds,
                    kwargs: { context: this.env.session.user_context },
                },
                {
                    timeout: 30000,
                    shadow: true,
                }
            );

            // Part 3: Download invoice.
            await this._downloadInvoice(orderIds);

            OrderFetcher.invalidateCache(orderIds);
            await OrderFetcher.fetch();
            this.selectedOrder = OrderFetcher.get(this.selectedOrder.backendId);
        }
        async _onClick() {
            try {
                await this._invoiceOrder();
            } catch (error) {
                if (this.isRpcError(error) && error.message.code < 0) {
                    this.showPopup('ErrorPopup', {
                        title: this.env._t('Network Error'),
                        body: this.env._t('Unable to invoice order.'),
                    });
                } else {
                    throw error;
                }
            }
        }
    }
    InvoiceButton.template = 'InvoiceButton';

    OrderManagementScreen.addControlButton({
        component: InvoiceButton,
        condition: function () {
            return this.env.pos.config.module_account;
        },
    });

    Registries.Component.add(InvoiceButton);

    return InvoiceButton;
});
