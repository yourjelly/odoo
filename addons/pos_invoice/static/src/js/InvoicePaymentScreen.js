odoo.define('pos_invoice.InvoicePaymentScreen', function (require) {
    'use strict';

    const models = require('point_of_sale.models');
    const IndependentToOrderScreen = require('point_of_sale.IndependentToOrderScreen');
    const Registries = require('point_of_sale.Registries');
    const NumberBuffer = require('point_of_sale.NumberBuffer');
    const { useListener } = require('web.custom_hooks');

    const invoicePaymentsMap = {};

    class InvoicePaymentScreen extends IndependentToOrderScreen {
        constructor() {
            super(...arguments);
            useListener('update-selected-paymentline', this._onUpdateSelectedPayment);
            useListener('new-payment-line', this._onNewPayment);
            useListener('delete-payment-line', this._onDeletePayment);
            useListener('select-payment-line', this._onSelectPayment);
            NumberBuffer.use({
                // capture input from numpad
                nonKeyboardInputEvent: 'input-from-numpad',
                // event triggered when successfully pressed a digit
                triggerAtInput: 'update-selected-paymentline',
            });
            this.payment_methods_from_config = this.env.pos.payment_methods.filter((method) => {
                return (
                    this.env.pos.config.payment_method_ids.includes(method.id) &&
                    (method.is_cash_count ? true : method.bank_journal_id)
                );
            });
            if (!(this.props.invoice.id in invoicePaymentsMap)) {
                invoicePaymentsMap[this.props.invoice.id] = new models.PaymentlineCollection();
            }
            this.paymentLines = invoicePaymentsMap[this.props.invoice.id];
            owl.hooks.onMounted(() => {
                this.paymentLines.on('remove change', this.render, this);
            });
            owl.hooks.onWillUnmount(() => {
                this.paymentLines.off('remove change', null, this);
            });
            this.selectedPayment = this.paymentLines.find((payment) => payment.selected);
        }
        async onValidate() {
            const paymentsVals = [];
            for (const payment of this.paymentLines.models) {
                paymentsVals.push({
                    journal_id: this.getJournalId(payment),
                    amount: payment.amount,
                });
            }
            if (!paymentsVals.length) return;
            const result = await this.rpc({
                model: 'account.move',
                method: 'pay_invoice',
                args: [[this.props.invoice.id], paymentsVals],
            });
            if (!result) {
                await this.showPopup('ErrorPopup', {
                    title: this.env._t('Payment Error'),
                    body: this.env._t('Error occurred when registering payment in invoice.'),
                });
            } else {
                const { confirmed } = await this.showPopup('ConfirmPopup', {
                    title: this.env._t('Payment Successful'),
                    body: this.env._t('Do you want to print the invoice?'),
                });
                if (confirmed) {
                    await this.env.pos.do_action('account.account_invoices', {
                        additional_context: {
                            active_ids: [this.props.invoice.id],
                        },
                    });
                }
            }
            this.showScreen('InvoiceListScreen');
        }
        _onUpdateSelectedPayment() {
            if (NumberBuffer.get() === null && this.selectedPayment) {
                this._onDeletePayment({ detail: { cid: this.selectedPayment.cid } });
            } else {
                this.selectedPayment.set_amount(NumberBuffer.getFloat());
            }
        }
        _onDeletePayment(event) {
            const paymentToDelete = this.paymentLines.get(event.detail.cid);
            this.paymentLines.remove(paymentToDelete);
        }
        _onNewPayment(event) {
            const newPaymentline = new models.Paymentline({}, { payment_method: event.detail, pos: this.env.pos });
            newPaymentline.set_amount(this.getRemaining());
            this.paymentLines.add(newPaymentline);
            this._onSelectPayment({ detail: { cid: newPaymentline.cid } });
        }
        _onSelectPayment(event) {
            const paymentToSelect = this.paymentLines.get(event.detail.cid);
            if (!paymentToSelect) return;
            for (const payment of this.paymentLines.models) {
                if (payment.selected) payment.set_selected(false);
            }
            paymentToSelect.set_selected(true);
            this.selectedPayment = paymentToSelect;
            NumberBuffer.reset();
        }
        getPayments() {
            return invoicePaymentsMap[this.props.invoice.id];
        }
        getAmountToPay() {
            return this.props.invoice.amount_residual;
        }
        getTotalPayments() {
            return this.getPayments().reduce((total, payment) => total + payment.amount, 0);
        }
        getRemaining() {
            return this.getAmountToPay() - this.getTotalPayments();
        }
        getChange() {
            const remaining = this.getRemaining();
            return remaining <= 0 ? -remaining : 0;
        }
        isFullyPaid() {
            return this.getTotalPayments() >= this.getAmountToPay();
        }
        getJournalId(payment) {
            const paymentMethod = payment.payment_method;
            if (paymentMethod.is_cash_count) {
                return paymentMethod.cash_journal_id[0];
            } else {
                return paymentMethod.bank_journal_id[0];
            }
        }
    }
    InvoicePaymentScreen.template = 'point_of_sale.InvoicePaymentScreen';

    Registries.Component.add(InvoicePaymentScreen);

    return InvoicePaymentScreen;
});
