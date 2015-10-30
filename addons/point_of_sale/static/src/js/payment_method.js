odoo.define('point_of_sale.electronic_payment_method', function (require) {
"use strict";

var core = require('web.core');
var pos_models = require('point_of_sale.models');

var AbstractPaymentMethod = core.Class.extend({
    init: function (journal_code) {
        var self = this;

        // todo jov: maybe this isn't the best way to map
        // account.journal to this
        this.journal_code = journal_code;

        var _super_posmodel = pos_models.PosModel.prototype;
        pos_models.PosModel = pos_models.PosModel.extend({
            initialize: function (session, attributes) {
                var super_return = _super_posmodel.initialize.apply(this, arguments);
                this.electronic_payment_methods.push(self);

                return super_return;
            }
        });
    },

    // In case of something like Mercury you could just ignore
    // this. It's here for payment methods that maybe want to
    // immediately pay the full amount.
    on_create_paymentline: function (created_paymentline) {
        throw new Error("PaymentMethod select not implemented.");
    },

    // This would be triggered by the swipe in the case of
    // Mercury. The POS would just call pay() of the electronic
    // payment method currently waiting on it.
    //
    // Users should somehow trigger this themselves because I have no
    // idea how to do it otherwise. With something like Mercury it's a
    // barcode that will match an entry in the barcode
    // nomenclature. With a European style chip and pin it'll probably
    // be a button on the screen.
    //
    // Furthermore, the implementation of this function should set
    // whatever metadata we need to keep (for eg. a reversal) on the
    // paymentline (and in export_as_json() etc.).
    pay: function (amount) {
        throw new Error("PaymentMethod pay not implemented.");
    },

    // Pretty sure we'll need to do one request per order
    finalize_tip: function (order) {
        throw new Error("PaymentMethod finalize_tip not implemented.");
    },

    // Not really sure how this works in Mercury yet
    close_batch: function () {
        throw new Error("PaymentMethod close_batch not implemented.");
    },

    // Should have paymentline as arg I suppose?
    remove: function () {
        throw new Error("PaymentMethod remove not implemented.");
    }
});

// ----------------
// example usage:
var ImplementedPaymentMethod = AbstractPaymentMethod.extend({
    on_create_paymentline: function () {
        console.log("implemented on_create_paymentline");
    },

    pay: function (amount) {
        console.log("implemented pay");
    },

    remove: function () {
        console.log("implemented remove");
    }
});
var instance = new ImplementedPaymentMethod("BNK1");
var instance2 = new ImplementedPaymentMethod("CSH1");
// ----------------

return AbstractPaymentMethod;
});
