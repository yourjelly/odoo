/** @odoo-module */
import { _t } from "@web/core/l10n/translation";
import { PaymentInterface } from "@point_of_sale/app/payment/payment_interface";
import { ErrorPopup } from "@point_of_sale/app/errors/popups/error_popup";

export class PaymentMercadoPago extends PaymentInterface {
    setup() {
        super.setup(...arguments);
        this.webhook_resolver = null;
        this.payment_cancel_ok_resolver = null;
        this.payment_cancel_error_resolver = null;
        this.payment_intent = {};
        this.create_payment_intent = () =>
            new Promise((resolve) => {
                const line = this.pos.get_order().selected_paymentline;
                // Build informations for creating a payment intend on Mercado Pago
                // Data in "external_reference" are send back with the webhook notification
                const infos = {
                    amount: line.amount * 100,
                    additional_info: {
                        external_reference: `${this.pos.pos_session.id}_${line.payment_method.id}`,
                        print_on_terminal: true,
                    },
                };
                // mp_payment_intent_create will call the Mercado Pago api
                this.env.services.orm.silent
                    .call("pos.payment.method", "mp_payment_intent_create", [
                        [line.payment_method.id],
                        infos,
                    ])
                    .then((result) => {
                        resolve(result);
                    });
            });
        this.last_status_payment_intent = () =>
            new Promise((resolve) => {
                const line = this.pos.get_order().selected_paymentline;
                // mp_payment_intent_get will return the last payment intend
                // recorded in the db by the last authenticated webhook
                this.env.services.orm.silent
                    .call("pos.payment.method", "mp_payment_intent_get", [
                        [line.payment_method.id],
                        this.payment_intent.id,
                    ])
                    .then((result) => {
                        resolve(result);
                    });
            });
        this.cancel_payment_intent = () =>
            new Promise((resolve) => {
                const line = this.pos.get_order().selected_paymentline;
                // mp_payment_intent_cancel will call the Mercado Pago api
                this.env.services.orm.silent
                    .call("pos.payment.method", "mp_payment_intent_cancel", [
                        [line.payment_method.id],
                        this.payment_intent.id,
                    ])
                    .then((result) => {
                        resolve(result);
                    });
            });
    }

    async send_payment_request(cid) {
        await super.send_payment_request(...arguments);
        const line = this.pos.get_order().selected_paymentline;
        const MAX_RETRY = 5; // Maximum number of retries for the "ON_TERMINAL" BUG
        const RETRY_DELAY = 1000; // Delay between retries in milliseconds for the "ON_TERMINAL" BUG
        try {
            // During payment creation, user can't cancel the payment intent
            line.set_payment_status("waitingCapture");

            // Call Mercado Pago to create a payment intent
            const payment_intent = await this.create_payment_intent();

            if ("id" in payment_intent) {
                this.payment_intent = payment_intent;
            } else {
                this._showMsg(payment_intent.message, "error");
                return false;
            }

            // After payment creation, make the payment intent canceling possible
            line.set_payment_status("waitingCard");

            do {
                // Payment intend is on the terminal, wait for transaction status change.
                // + add a special case when it's no more possible to cancel a payment from the frontend
                //   but only from the terminal
                var val = await Promise.any([
                    new Promise((resolve) => {
                        this.webhook_resolver = resolve;
                    }),
                    new Promise((resolve) => {
                        this.payment_cancel_error_resolver = resolve;
                    }),
                    new Promise((resolve) => {
                        this.payment_cancel_ok_resolver = resolve;
                    }),
                ]);
                // Check result
                switch (val) {
                    case "mp_webhook":
                        // We received a notification that Mercado Pago sent a webhook message
                        // to the backend, get the last status
                        // If no id in this.payment_intent that means user reload the page
                        // or it is an old webhook -> trash
                        if ("id" in this.payment_intent) {
                            // Call Mercado Pago to get the status of the payment intent
                            var last_status_payment_intent =
                                await this.last_status_payment_intent();
                            // Check if the payment id is the same as the one
                            // we received on the payment intend creation
                            if (this.payment_intent.id == last_status_payment_intent.id) {
                                switch (last_status_payment_intent.state) {
                                    case "FINISHED":
                                        line.set_payment_status("done");
                                        this._showMsg(_t("Payment accepted"), "info");
                                        return true;
                                    case "OPEN":
                                    case "ON_TERMINAL":
                                        // BUG Sometimes the Mercado Pago webhook return ON_TERMINAL
                                        // instead of CANCELED/FINISHED when we requested a payment status
                                        // that was actually canceled/finished by the user on the terminal.
                                        // Then the strategy here is to ask Mercado Pago MAX_RETRY times the
                                        // payment intent status, hoping going out of this status

                                        // Loop until MAX_RETRY is reached
                                        var retryCount = 0;
                                        while (retryCount < MAX_RETRY) {
                                            last_status_payment_intent =
                                                await this.last_status_payment_intent();
                                            if (last_status_payment_intent.state === "FINISHED") {
                                                line.set_payment_status("done");
                                                this._showMsg(_t("Payment accepted"), "info");
                                                return true;
                                            }
                                            if (last_status_payment_intent.state === "CANCELED") {
                                                this._showMsg(
                                                    _t("Payment has been canceled"),
                                                    "info"
                                                );
                                                return false;
                                            }
                                            console.log(
                                                `Attempt ${
                                                    retryCount + 1
                                                }: Received ON_TERMINAL, retrying...`
                                            );
                                            await new Promise((resolve) =>
                                                setTimeout(resolve, RETRY_DELAY)
                                            );
                                            retryCount++;
                                        }
                                        this._showMsg(
                                            "Payment status could not be confirmed",
                                            "error"
                                        );
                                        return false;

                                    case "ABANDONED":
                                    case "CANCELED":
                                        this._showMsg(_t("Payment has been canceled"), "info");
                                        return false;
                                    default:
                                        this._showMsg(_t("Unknown response: "), "error");
                                        return false;
                                }
                            } else {
                                throw _t("Payment unrecognized");
                            }
                        }
                        return false;

                    case "payment_canceled":
                        this._showMsg(_t("Payment has been canceled"), "info");
                        break;

                    case "to_be_canceled_on_terminal":
                        // User tried to cancel the payment from the front end. But it's no more
                        // possible to do this from the front end, we alert the seller about this
                        // and we redo the process to not loose the webhook
                        this._showMsg(_t("Payment has to be canceled on the terminal"), "info");
                        break;
                }
            } while (val == "to_be_canceled_on_terminal");
        } catch (error) {
            this._showMsg(error, "System error");
            return false;
        }
    }

    async send_payment_cancel(order, cid) {
        super.send_payment_cancel(order, cid);

        if ("id" in this.payment_intent) {
            // Call Mercado Pago to cancel the payment intent
            // If the response is Error, that means we can't cancel the payment on the pos
            // and the canceling has to be done on the terminal
            const canceling_status = await this.cancel_payment_intent();
            if ("error" in canceling_status) {
                if (canceling_status.status == "409") {
                    this.payment_cancel_error_resolver("to_be_canceled_on_terminal");
                    return false;
                } else {
                    // "404" payment not found
                    this._showMsg(
                        _t("Payment not found (already canceled or finished on terminal)"),
                        "info"
                    );
                    return true;
                }
            } else {
                this.payment_cancel_ok_resolver("payment_canceled");
                return true;
            }
        }
        return true;
    }

    // private methods
    _showMsg(msg, title) {
        this.env.services.popup.add(ErrorPopup, {
            title: "Mercado Pago " + title,
            body: msg,
        });
    }
}
