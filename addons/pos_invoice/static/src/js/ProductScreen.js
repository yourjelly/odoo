/* @odoo-module alias=pos_invoice.ProductScreen */

import ProductScreen from 'point_of_sale.ProductScreen';
import Registries from 'point_of_sale.Registries';

const PosInvoiceProductScreen = (ProductScreen) =>
    class extends ProductScreen {
        async _onClickCustomer() {
            if (!this.currentOrder.paid_invoice_id) {
                await super._onClickCustomer(...arguments);
            }
        }
        async _clickProduct() {
            if (!this.currentOrder.paid_invoice_id) {
                await super._clickProduct(...arguments);
            } else {
                this.showPopup('ErrorPopup', {
                    title: this.env._t("Invalid Operation"),
                    body: this.env._t("You can't add product on order that is created to pay an invoice."),
                });
            }
        }
    };

Registries.Component.extend(ProductScreen, PosInvoiceProductScreen);

export default ProductScreen;
