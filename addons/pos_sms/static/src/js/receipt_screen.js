/** @odoo-module */

import { ReceiptScreen } from "@point_of_sale/app/screens/receipt_screen/receipt_screen";
import { _t } from "@web/core/l10n/translation";
import { patch } from "@web/core/utils/patch";

import { useState } from "@odoo/owl";

patch(ReceiptScreen.prototype, {
    setup() {
        super.setup(...arguments);
        const partner = this.currentOrder.get_partner();
        this.smsState = useState({
            inputsms: partner && partner.email ? partner.email : partner && partner.mobile ? partner.mobile : '',
            isSending: false,
            smsButtonDisabled: false,
            smsNotice: "",
            smsSuccessful: null,
        });
    },

    get is_valid_mobile() {
        const value = this.smsState.inputsms;
        if (value) {
            const valueLen = value.replace(/[^0-9]/g, "").length;
            return valueLen > 8 && valueLen < 15;
        }
        return false;
    },

    _updateSmsState(status, msg) {
        this.smsState.smsSuccessful = status;
        this.smsState.smsNotice = msg;
    },

    onInputChange(ev) {
        super.onInputChange(...arguments);
        this.smsState.smsButtonDisabled = false;
        this.smsState.inputsms = ev.target.value;
    },

    async onClickSend(type) {
        super.onClickSend(...arguments);
        if (type === 'sms') {
            this.onSendSms();
        }
    },

    async onSendSms() {
        if (this.smsState.isSending) {
            this._updateSmsState(false, _t("Sending in progress"));
            return;
        }
        this.smsState.isSending = true;
        this.smsState.smsNotice = "";

        if (!this.is_valid_mobile) {
            this._updateSmsState(false, _t("Invalid Number"));
            this.smsState.isSending = false;
            return;
        }

        // Delay to allow the user to see the wheel that informs that the sms message will be sent
        setTimeout(async () => {
            try {
                await this._sendSmsReceiptToCustomer();
                this._updateSmsState(true, _t("SMS sent"));
            } catch (error) {
                console.error(error);
                this._updateSmsState(
                    false,
                    _t("Something went wrong, please check the number and try again.")
                );
                this.smsState.smsButtonDisabled = true;
            }
            this.smsState.isSending = false;
        }, 1000);
    },

    async _sendSmsReceiptToCustomer() {
        const partner = this.currentOrder.get_partner();
        const orderPartner = {
            name: partner ? partner.name : this.smsState.inputsms,
            sms: this.smsState.inputsms,
        };
        await this.sendToCustomer(orderPartner, "action_sent_message_on_sms");
    },
});
