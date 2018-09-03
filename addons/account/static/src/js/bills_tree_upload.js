odoo.define('account.bills.tree.upload_button', function (require) {
"use strict";

    var ListController = require('web.ListController');

    ListController.include({
        /**
         * Extends the renderButtons function of ListView by adding an event listener
         * on the bill upload button.
         *
         * @override
         */
        renderButtons: function () {
            this._super.apply(this, arguments); // Possibly sets this.$buttons
            if (this.$buttons) {
                var self = this;
                this.$buttons.on('click', '.o_button_upload_bill', function () {
                    var state = self.model.get(self.handle, {raw: true});
                    self.do_action({
                        type: 'ir.actions.act_window',
                        res_model: 'account.invoice.import.wizard',
                        target: 'new',
                        views: [[false, 'form']],
                        context: {'type': 'in_invoice'},
                    });
                });
            }
        }
    });
});
