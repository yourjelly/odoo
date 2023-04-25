/** @odoo-module */

import { _t } from "@web/core/l10n/translation";
import { PaymentInterface } from "@point_of_sale/app/payment/payment_interface";
import { ErrorPopup } from "@point_of_sale/app/errors/popups/error_popup";
import { sprintf } from "@web/core/utils/strings";
import { uuidv4 } from "@point_of_sale/utils";

export class PaymentVivaWallet extends PaymentInterface {

    /*
     Developer documentation:
    https://developer.vivawallet.com/apis-for-point-of-sale/card-terminals-devices/rest-api/eft-pos-api-documentation/
    */

    setup() {
        super.setup(...arguments);
        this.paymentLineResolvers = {};
    }
    set_most_recent_service_id(id) {
        this.most_recent_service_id = id;
    }
    pending_viva_wallet_line() {
        return this.pos.getPendingPaymentLine("viva_wallet");
    }

    _handle_odoo_connection_failure(data = {}) {
        // handle timeout
        var line = this.pending_viva_wallet_line();
        if (line) {
            line.set_payment_status("retry");
        }
        this._show_error(
            _t(
                "Could not connect to the Odoo server, please check your internet connection and try again."
            )
        );

        return Promise.reject(data); // prevent subsequent onFullFilled's from being called
    }

    async send_payment_request () {
        /**
         * Override
         */
        await super.send_payment_request(...arguments);
        var order = this.pos.get_order();
        var line = order.selected_paymentline;
        let customerTrns = ' ';
        line.set_payment_status("waitingCard");

        if (line.amount < 0) {
            this._show_error(_t("Cannot process transactions with negative amount."));
            return false;
        }

        if (order.partner) {
            customerTrns = order.partner.name + ' - ' + order.partner.email
        }

        line.sessionId = order.uid + ' - ' + uuidv4();
        var data = {
            "sessionId": line.sessionId,
            "terminalId": line.payment_method.viva_wallet_terminal_id,
            "cashRegisterId": this.pos.get_cashier().name,
            "amount": line.amount * 100,
            "currencyCode": this.pos.currency.numeric_code, // Viva wallet only uses EUR
            "merchantReference": line.sessionId + '/' + this.pos.pos_session.id,
            "customerTrns": customerTrns,
            "preauth": false,
            "maxInstalments": 0,
            "tipAmount": 0
        };
        return this._call_viva_wallet(data).then((data) => {
            return this._viva_wallet_handle_response(data);
        });
/*        try {
            return this.pos.env.services.orm.silent
                .call(
                    "pos.payment.method",
                    "viva_wallet_send_payment_request",
                    [[this.payment_method.id], data]
                )
                .catch(this._handle_odoo_connection_failure.bind(this));
            if (resp.error) {
                console.log('resp.error');
                throw resp.error;
            }
            line.set_payment_status("waitingCard");


        } catch (error) {
            this._showError(error, 'Unable to send payment');
            return false;
        }*/
/*        try {
            const resp = await this.pos.env.services.orm.silent.call(
                "pos.payment.method",
                "viva_wallet_send_payment_request",
                [[this.payment_method.id], data]
            );
            if (resp.error) {
                console.log('resp.error');
                throw resp.error;
            }
            line.set_payment_status("waitingCard");


        } catch (error) {
            this._showError(error, 'Unable to send payment');
            return false;
        }*/
    }

    _call_viva_wallet(data) {
        return this.env.services.orm.silent
            .call("pos.payment.method",
                "viva_wallet_send_payment_request",
                [[this.payment_method.id], data]
            )
            .catch(this._handle_odoo_connection_failure.bind(this));
    }

    _viva_wallet_handle_response(response) {
        var line = this.pending_viva_wallet_line();
        line.set_payment_status("waitingCard");
        return this.waitForPaymentConfirmation();
    }

    waitForPaymentConfirmation() {
        return new Promise((resolve) => {
            this.paymentLineResolvers[this.pending_viva_wallet_line().cid] = resolve;
        });
    }

    async send_payment_cancel (order, cid) {
        /**
         * Override
         */
        super.send_payment_cancel(...arguments);
        const line = this.pos.get_order().selected_paymentline;

        var data = {
            "sessionId": line.sessionId,
            "cashRegisterId": this.pos.get_cashier().name
        };
        try {
            const resp = await this.pos.env.services.orm.silent.call(
                "pos.payment.method",
                "viva_wallet_send_payment_cancel",
                [[this.payment_method.id], data]
            );
            if (resp.error) {
                throw resp.error;
            }
        } catch (error) {
            this._showError(error, 'Unable to cancel payment');
            return false;
        }
        line.set_payment_status("retry");
        return true;
    }

    /**
     * This method is called from pos_bus when the payment
     * confirmation from Viva Wallet is received via the webhook.
     */
    async handleVivaWalletStatusResponse() {
        var line = this.pending_viva_wallet_line();
        const notification = await this.env.services.orm.silent.call(
            "pos.payment.method",
            "get_latest_viva_wallet_status",
            [[this.payment_method.id]]
        );

        if (!notification) {
            this._handle_odoo_connection_failure();
            return;
        }

/*        const line = this.pending_viva_wallet_line();
        const response = notification.SaleToPOIResponse.PaymentResponse.Response;
        const additional_response = new URLSearchParams(response.AdditionalResponse);
        */
        const isPaymentSuccessful = this.isPaymentSuccessful(notification);
        if (isPaymentSuccessful) {
            this.handleSuccessResponse(line, notification);
        } else {
            this._show_error(
                sprintf(_t("Message from Viva Wallet: %s"), notification.get("message"))
            );
        }

        // when starting to wait for the payment response we create a promise
        // that will be resolved when the payment response is received.
        // In case this resolver is lost ( for example on a refresh ) we
        // we use the handle_payment_response method on the payment line
        const resolver = this.paymentLineResolvers?.[line.cid];
        if (resolver) {
            resolver(isPaymentSuccessful);
        } else {
            line.handle_payment_response(isPaymentSuccessful);
        }
    }

    isPaymentSuccessful(notification) {
        return (
            notification &&
            notification.sessionId ==
                this.pending_viva_wallet_line().sessionId &&
            notification.success
        );
    }

    handleSuccessResponse(line, notification) {

/*        const cashier_receipt = payment_response.PaymentReceipt.find((receipt) => {
            receipt.DocumentQualifier == "CashierReceipt";
        });

        if (cashier_receipt) {
            line.set_cashier_receipt(
                this._convert_receipt_info(cashier_receipt.OutputContent.OutputText)
            );
        }

        const customer_receipt = payment_response.PaymentReceipt.find((receipt) => {
            receipt.DocumentQualifier == "CustomerReceipt";
        });

        if (customer_receipt) {
            line.set_receipt_info(
                this._convert_receipt_info(customer_receipt.OutputContent.OutputText)
            );
        }*/

        line.transaction_id = notification.transactionId;
        line.card_type = notification.applicationLabel;
        line.cardholder_name = notification.FullName || "";
    }

    // private methods

    _showError (msg, title) {
        if (!title) {
            title = "Viva Wallet Error";
        }
        this.pos.env.services.popup.add(ErrorPopup, {
            title: title,
            body: msg,
        });
    }
};

