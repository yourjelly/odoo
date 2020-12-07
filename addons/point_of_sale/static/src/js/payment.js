odoo.define('point_of_sale.PaymentInterface', function (require) {
"use strict";

var core = require('web.core');

/**
 * This is the container of concrete implementations of PaymentInterface.
 * Use `registerImplementation` to populate this container.
 * Use `getImplementation` to get a specific implementation.
 */
const Implementations = {};

/**
 * Implement this interface to support a new payment method in the POS:
 *
 * ```
 * var { PaymentInterface, registerImplementation } = require('point_of_sale.PaymentInterface');
 * var MyPayment = PaymentInterface.extend({
 *     ...
 * })
 * // Register the implementation so that it can be properly instantiated by PointOfSaleModel.
 * registerImplementation('my_payment', MyPayment);
 *```
 * my_payment is the technical name of the added selection in
 * use_payment_terminal.
 *
 * If necessary new fields can be loaded on any model:
 *
 * models.load_fields('pos.payment.method', ['new_field1', 'new_field2']);
 */
var PaymentInterface = core.Class.extend({
    init: function (model, payment_method) {
        this.model = model;
        this.payment_method = payment_method;
        this.supports_reversals = false;
    },

    /**
     * Call this function to enable UI elements that allow a user to
     * reverse a payment. This requires that you implement
     * send_payment_reversal.
     */
    enable_reversals: function () {
        this.supports_reversals = true;
    },

    /**
     * Called when a user clicks the "Send" button in the
     * interface. This should initiate a payment request and return a
     * Promise that resolves when the final status of the payment line
     * is set with set_payment_status.
     *
     * For successful transactions set_receipt_info() should be used
     * to set info that should to be printed on the receipt. You
     * should also set card_type and transaction_id on the line for
     * successful transactions.
     *
     * @param {string} cid - The id of the paymentline
     * @returns {Promise} resolved with a boolean that is false when
     * the payment should be retried. Rejected when the status of the
     * paymentline will be manually updated.
     */
    send_payment_request: function (cid) {},

    /**
     * Called when a user removes a payment line that's still waiting
     * on send_payment_request to complete. Should execute some
     * request to ensure the current payment request is
     * cancelled. This is not to refund payments, only to cancel
     * them. The payment line being cancelled will be deleted
     * automatically after the returned promise resolves.
     *
     * @param {} order - The order of the paymentline
     * @param {string} cid - The id of the paymentline
     * @returns {Promise}
     */
    send_payment_cancel: function (order, cid) {},

    /**
     * This is an optional method. When implementing this make sure to
     * call enable_reversals() in the constructor of your
     * interface. This should reverse a previous payment with status
     * 'done'. The paymentline will be removed based on returned
     * Promise.
     *
     * @param {string} cid - The id of the paymentline
     * @returns {Promise} returns true if the reversal was successful.
     */
    send_payment_reversal: function (cid) {},

    /**
     * Called when the payment screen in the POS is closed (by
     * e.g. clicking the "Back" button). Could be used to cancel in
     * progress payments.
     */
    close: function () {},
});

function registerImplementation(terminalName, Implementation) {
    if (terminalName in Implementations) {
        throw new Error(`An implementation of PaymentInterface for '${terminalName}' payment terminal has been registered.`);
    } else {
        Implementations[terminalName] = Implementation;
    }
}

function getImplementation(terminalName) {
    return Implementations[terminalName];
}

return { PaymentInterface, registerImplementation, getImplementation };
});
