/** @odoo-module */
import { PaymentInterface } from "@point_of_sale/app/payment/payment_interface";
import { ErrorPopup } from "@point_of_sale/app/errors/popups/error_popup";

export class PaymentMercadoPago extends PaymentInterface {
    setup() {
        super.setup(...arguments);
        this.webhook_resolver = null;
        this.payment_cancel_error_resolver = null;
        this.payment_intent = {};
        this.create_payment_intent = () => new Promise(resolve => {
            const line = this.pos.get_order().selected_paymentline;
            // Build informations for creating a payment intend on Mercado Pago
            // Data in "external_reference" are send back with the webhook notification
            const infos = {
                "amount": line.amount * 100,
                "additional_info": {
                    "external_reference": `${this.pos.pos_session.id}_${line.payment_method.id}`,
                    "print_on_terminal": true,
                },
            };
            // mp_payment_intent_create will call the Mercado Pago api
            this.env.services.orm.silent.call(
                "pos.payment.method",
                "mp_payment_intent_create",
                [[line.payment_method.id], infos]
            ).then(result => {
                resolve(result);
            });
        });
        this.last_status_payment_intent = () => new Promise(resolve => {
            const line = this.pos.get_order().selected_paymentline;
            // mp_payment_intent_get will return the last payment intend
            // recorded in the db by the last authenticated webhook
            this.env.services.orm.silent.call(
                "pos.payment.method",
                "mp_payment_intent_get",
                [[line.payment_method.id], this.payment_intent.id]
            ).then(result => {
                resolve(result);
            });
        });
        this.cancel_payment_intent = () => new Promise(resolve => {
            const line = this.pos.get_order().selected_paymentline;
            // mp_payment_intent_cancel will call the Mercado Pago api
            this.env.services.orm.silent.call(
                "pos.payment.method",
                "mp_payment_intent_cancel",
                [[line.payment_method.id], this.payment_intent.id]
            ).then(result => {
                resolve(result);
            });
        });
    }

    async send_payment_request(cid) {
        await super.send_payment_request(...arguments);
        const line = this.pos.get_order().selected_paymentline;
        try {
            // During payment creation, user can't cancel the payment intent
            line.set_payment_status("waitingCapture");

            // Call Mercado Pago to create a payment intent
            const payment_intent = await this.create_payment_intent();

            // In case of error, don't update 'this.payment_intent' and handle the error
            if (!("id" in payment_intent)) {
                switch(payment_intent.status) {
                    case 409:
                        // We don't return on this error case, we continue but
                        // without updating 'this.payment_intent'
                        this._showMsg("Payment already sent to terminal, check it...", 'information');
                        break;
                    case 400: // Payment must be >= 500 [units]
                    case 401: // Invalid token 
                    default:
                        this._showMsg(payment_intent.message, 'error');
                        return false;
                  }
            } else {
                this.payment_intent = payment_intent
            }

            // After payment creation, make the payment intent canceling possible
            line.set_payment_status("waitingCard");

            var val;
            do {
                // Payment intend is on the terminal, wait for transaction status change.
                // + set a timeout in case of no notification
                // + add a special case when it's no more possible to cancel a payment from the frontend
                //   but only from the terminal (user has pushed on the "Cobrar" blue button)
                val = await Promise.any([
                    new Promise(resolve => {setTimeout(() => resolve("timeout"), 60000);}),
                    new Promise(resolve => {this.webhook_resolver = resolve;}),
                    new Promise(resolve => {this.payment_cancel_error_resolver = resolve;}),
                ]);
                // Check result
                switch(val) {
                    case "timeout":
                        throw `There was a connection problem. PLEASE CANCEL PAYMENT ON THE TERMINAL 
                               otherwise it will not be taken into account on the Odoo system.`;

                    case "mp_msg_received":
                        // We received a notification that Mercado Pago sent a webhook message
                        // to the backend, get the last status
                        // If no id in this.payment_intent that means user reload the page
                        // or it is an old webhook -> trash
                        if ("id" in this.payment_intent) {
                            // Call Mercado Pago to get the status of the payment intent
                            const last_status_payment_intent = await this.last_status_payment_intent();
                            // Check if the payment id is the same as the one
                            // we received on the payment intend creation
                            if (this.payment_intent.id == last_status_payment_intent.id) {
                                switch(last_status_payment_intent.state) {
                                    case "FINISHED":
                                        line.set_payment_status("done");
                                        this._showMsg("Payment accepted", 'info');
                                        return true;
                                    case "OPEN":
                                        // BUG Sometimes Mercado Pago return OPEN instead of CANCELED
                                        // Not on the webhook but when we requested a payment status
                                        // that was previously canceled on the terminal
                                    case "ON_TERMINAL":
                                        // BUG Sometimes Mercado Pago return ON_TERMINAL instead of CANCELED
                                        // Not on the webhook but when we requested a payment status
                                        // that was previously canceled on the terminal
                                    case "ABANDONED":
                                    case "CANCELED":
                                        this._showMsg("Payment has been canceled", 'info');
                                        return false;
                                    default:
                                        this._showMsg("Unknown response: ", 'error');
                                        return false;
                                }
                            } else {
                                console.log("Payment intent: Bad id or no id");
                            }
                        }
                        return false;

                    case "to_be_canceled_on_terminal":
                        // User tried to cancel the payment from the front end. But the buyer has already
                        // pushed the "Cobrar" blue button on the terminal, hence it's no more possible to
                        // cancel the payment from the front end, we alert the seller about this and we
                        // redo the process to not loose the webhook
                        this._showMsg("Payment has to be canceled on the terminal", 'info');
                        break;
                }
            } while (val == "to_be_canceled_on_terminal")
            
        } catch (error) {
            this._showMsg(error, "System error");
            return false;
        }
    }

    async send_payment_cancel(order, cid) {
        super.send_payment_cancel(order, cid);
        // If the response is Error, that means we can't cancel the payment on the pos
        // and the canceling has to be done on the terminal
        if ("id" in this.payment_intent) {
            // Call Mercado Pago to cancel the payment intent
            const canceling_status = await this.cancel_payment_intent();
            if ("error" in canceling_status) {
                this.payment_cancel_error_resolver("to_be_canceled_on_terminal")
                return false;
            } 
        } else {
            console.log("payment has no id!");
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
