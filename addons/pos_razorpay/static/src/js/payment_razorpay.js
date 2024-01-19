/** @odoo-module */

import { _t } from "@web/core/l10n/translation";
import { PaymentInterface } from "@point_of_sale/app/payment/payment_interface";
import { AlertDialog } from "@web/core/confirmation_dialog/confirmation_dialog";

const REQUEST_TIMEOUT = 5000;

export class PaymentRazorpay extends PaymentInterface {
    setup() {
        super.setup(...arguments);
        this.p2pRequestId = {};
    }

    send_payment_request(cid) {
        super.send_payment_request(cid);
        return this._process_razorpay(cid);
    }

    pending_razorpay_line() {
        return this.pos.getPendingPaymentLine("razorpay");
    }

    send_payment_cancel(order, cid) {
        super.send_payment_cancel(order, cid);
        return this._razorpay_cancel();
    }

    _razorpay_cancel() {
        const razorpayCancelPayment = async () => {
            const paymentLine = this.pos.get_order()?.selected_paymentline;
            try {
                const response = await this.pos.data.silentCall(
                    "pos.payment.method",
                    "razorpay_cancel_payment_request",
                    [[this.payment_method.id], this.p2pRequestId]
                );
                if (response?.error) {
                    clearTimeout(this.responseTimeout);
                    paymentLine.set_payment_status("retry");
                    throw response?.error;
                }
            } catch (error) {
                this._showError(error, "razorpayCancelPaymentRequest");
                return true;
            }
        }
        return new Promise(razorpayCancelPayment);
    }

    _razorpay_payment_data() {
        const order = this.pos.get_order();
        const line = order.selected_paymentline;
        let orderId = order.name.replace(" ", "").replaceAll("-", "").toUpperCase();
        const referencePrefix = this.pos.config.name.replace(/\s/g, "").slice(0, 4);
        const referenceId = referencePrefix.concat(orderId).concat(Math.floor(Math.random() * 1000000000));
        const data = {
            'amount': line.amount,
            'referenceId': referenceId,
        };
        return data;
    }

    _handle_odoo_connection_failure(data = {}) {
        // handle timeout
        const line = this.pending_razorpay_line();
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

    _call_razorpay(payment_data) {
        return this.pos.data
            .silentCall("pos.payment.method", "razorpay_make_payment_request", [
                [this.payment_method.id],
                payment_data,
            ])
            .catch(this._handle_odoo_connection_failure.bind(this));
    }

    /**
     * This method handles the response that comes from Razorpay
     * when we first make a request to pay.
     */
    _razorpay_handle_response(response_data, payment_data, line) {
        try {
            if (response_data?.error) {
                line.set_payment_status("force_done");
                throw response_data.error;
            }
            this.p2pRequestId['p2pRequestId'] = response_data?.p2pRequestId;
            line.set_payment_status("waitingCard");
            return this._waitForPaymentConfirmation(payment_data, this.p2pRequestId);
        } catch (error) {
            this._showError(error, "razorpayMakePaymentRequest");
            return false;
        }
    }

    /**
     * This method calls and handles the razorpay status response
     * calls every 5 sec until payment status not found.
     */
    _waitForPaymentConfirmation(payment_data, p2p_request_id) {
        const razorpayFetchPaymentStatus = async (resolve, reject) => {
            const paymentLine = this.pos.get_order()?.selected_paymentline;
            if (!paymentLine || paymentLine.payment_status == "retry") {
                return false;
            }
            try {
                const response = await this.pos.data.silentCall(
                    "pos.payment.method",
                    "razorpay_fetch_payment_status",
                    [[this.payment_method.id], p2p_request_id]
                );
                if (response?.error) {
                    throw response?.error;
                }
                const resultCode = response?.status;
                if (resultCode === "AUTHORIZED" && response?.externalRefNumber !== payment_data?.referenceId) {
                    throw _t("Reference number mismatched");
                } else if (resultCode === "AUTHORIZED") {
                    paymentLine.razorpay_authcode = response?.authCode;
                    paymentLine.razorpay_issuer_card_no = response?.cardLastFourDigit;
                    paymentLine.razorpay_issuer_bank = response?.acquirerCode;
                    paymentLine.razorpay_payment_method = response?.paymentMode;
                    paymentLine.card_type = response?.paymentCardType;
                    paymentLine.razorpay_card_scheme = response?.paymentCardBrand;
                    paymentLine.razorpay_reference_no = response?.externalRefNumber;
                    paymentLine.transactionId = response?.txnId;
                    paymentLine.payment_date = response?.createdTime;
                    paymentLine.settlementStatus = response?.settlementStatus;
                    paymentLine.userAgreement = response?.userAgreement;
                    return resolve(response);
                } else {
                    this.responseTimeout = setTimeout(
                        razorpayFetchPaymentStatus,
                        REQUEST_TIMEOUT,
                        resolve,
                        reject
                    );
                }
            } catch (error) {
                paymentLine.set_payment_status("force_done");
                this._showError(error, "razorpayFetchPaymentStatus");
                return resolve(false);
            }
        };
        return new Promise(razorpayFetchPaymentStatus);
    }

    _process_razorpay(cid) {
        const order = this.pos.get_order();
        const line = order.paymentlines.find((paymentLine) => paymentLine.cid === cid);

        if (order.selected_paymentline.amount < 0) {
            this._showError(_t("Cannot process transactions with negative amount."));
            return Promise.resolve();
        }

        const payment_data = this._razorpay_payment_data();
        return this._call_razorpay(payment_data).then((response_data) => {
            return this._razorpay_handle_response(response_data, payment_data, line);
        });
    }

    _showError(error_msg, title) {
        this.env.services.dialog.add(AlertDialog, {
            title: title || _t("Razorpay Error"),
            body: error_msg,
        });
    }
}
