odoo.define('point_of_sale.electronic_payment_method', function (require) {
    "use strict";

    var core = require('web.core');
    var exports = {};

    exports.AbstractPaymentMethod = core.Class.extend({
        init: function (journal_id) {
            var self = this;

            this.journal_id = journal_id;
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
        remove: function (paymentline) {
            throw new Error("PaymentMethod remove not implemented.");
        }
    });

    // This class will contain payment metadata. It can hold things like
    // the last 4 numbers of a credit card or a returned token that can be
    // used to reverse the transaction later. These objects should be
    // associated to exactly one Paymentline.
    //
    // It would also be nice if we could somehow create an abstraction for
    // the {export,import}_as_JSON stuff, because it's a weird little
    // quirk in our application that is annoying if you don't know about
    // it.
    exports.ElectronicPaymentInformation = core.Class.extend({
        init: function(order){
            this.order = order;
            this.metadata = {};
        },
        is_empty: function(){
            return _.isEmpty(this.metadata);
        },
        init_from_JSON: function(json){
            _.forEach(_.keys(json), function (key) {
                this[key] = json[key];
            });
        },
        export_as_JSON: function(){
            return this.metadata;
        },
        // This sets the metadata of the paymentline. Metadata should be
        // an object where values all the values are primitive data types.
        set_metadata: function(metadata){
            // Ensure that there are no objects in metadata, because they
            // won't export nicely
            _.forEach(metadata, function (value) {
                if (typeof value === 'object') {
                    throw new Error("Metadata cannot contain objects as values.");
                }
            });

            this.metadata = metadata;

            // trigger export_to_JSON to ensure the metadata survives a refresh
            this.order.trigger('change', this.order);
        }
    });

    return exports;
});

// ----------------
// example usage:
odoo.define('point_of_sale.electronic_payment_method_usage_example', function (require) {
    var pos_models = require('point_of_sale.models');
    var electronic_payment_method = require('point_of_sale.electronic_payment_method');

    var ImplementedPaymentMethod = electronic_payment_method.AbstractPaymentMethod.extend({
        on_create_paymentline: function () {
            console.log("implemented on_create_paymentline");
        },

        pay: function (amount) {
            console.log("implemented pay");
        },

        remove: function (paymentline) {
            console.log("implemented remove");
        }
    });

    var _super_posmodel = pos_models.PosModel.prototype;
    pos_models.PosModel = pos_models.PosModel.extend({
        after_load_server_data: function () {
            var self = this;

            // users will need to somehow find the journal they want
            // to use by searching through the cashregisters
            this.cashregisters.forEach(function (cashregister) {
                var journal = cashregister.journal;
                if (journal.code === "CSH1") {
                    var payment_method = new ImplementedPaymentMethod(journal.id);
                    self.electronic_payment_methods.push(payment_method);
                }
            });

            return _super_posmodel.after_load_server_data.apply(this, arguments);
        }
    });
});
// ----------------
