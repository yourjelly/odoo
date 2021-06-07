/* @odoo-module alias=pos_invoice.PaymentScreen */

import PaymentScreen from 'point_of_sale.PaymentScreen';
import Registries from 'point_of_sale.Registries';

const PosInvoicePaymentScreen = (PaymentScreen) =>
    class extends PaymentScreen {
        async selectClient() {
            if (!this.currentOrder.paid_invoice_id) {
                await super.selectClient(...arguments);
            }
        }
    };

Registries.Component.extend(PaymentScreen, PosInvoicePaymentScreen);

export default PaymentScreen;
