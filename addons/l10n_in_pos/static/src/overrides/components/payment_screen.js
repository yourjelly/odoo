import { patch } from "@web/core/utils/patch";
import { ShipLater } from "./ship_later";
import { _t } from "@web/core/l10n/translation";
import { PaymentScreen } from "../../../../../point_of_sale/static/src/app/screens/payment_screen/payment_screen";
import { AlertDialog } from "@web/core/confirmation_dialog/confirmation_dialog";

patch(PaymentScreen.prototype, {
    setup() {
        super.setup();
        this.currentOrder.l10n_in_state_id = this.pos.company.state_id;
    },
    async toggleShippingDatePicker() {
        if (!this.currentOrder.getShippingDate()) {
            this.dialog.add(ShipLater, {
                title: _t("Select the shipping date"),
                getPayload: (shippingDate, stateId) => {
                    this.currentOrder.setShippingDate(shippingDate);
                    this.currentOrder.l10n_in_state_id = stateId;
                },
                order: this.currentOrder,
            });
        } else {
            this.currentOrder.setShippingDate(false);
        }
    },

    async validateOrder(isForceValidate) {
        if( !this.pos.config.ship_later || this.isValid){
            super.validateOrder(isForceValidate);
        }
        else{
            this.dialog.add(AlertDialog, {
                title: _t("Invoice Mandatory"),
                body: _t(
                    "For Intra State Invoice is Mandatory"
                ),
            });
        }
    },

    get isValid(){
        return this.pos.company.state_id == this.currentOrder.l10n_in_state_id || this.currentOrder.to_invoice;
    }
});

