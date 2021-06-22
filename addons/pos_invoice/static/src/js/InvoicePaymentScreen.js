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
            this.payment_methods_from_config = this.env.pos.payment_methods.filter((method) =>
                this.env.pos.config.payment_method_ids.includes(method.id)
            );
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
        onValidate() {
            alert('validated!');
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
            this._onSelectPayment({ detail: { cid: newPaymentline.cid } })
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
    }
    InvoicePaymentScreen.template = 'point_of_sale.InvoicePaymentScreen';

    Registries.Component.add(InvoicePaymentScreen);

    return InvoicePaymentScreen;
});
