odoo.define('odoo_payments.account_views', function (require) {
"use strict";

const core = require('web.core');
const Dialog = require('web.Dialog');
const FormController = require('web.FormController');
const FormView = require('web.FormView');
const viewRegistry = require('web.view_registry');

const _t = core._t;
const QWeb = core.qweb;

const AdyenAccountFormController = FormController.extend({
    _discardChanges: function (recordID, options) {
        this._super.apply(this, arguments);
        this.do_action({type: 'ir.actions.act_url', url: '/web', target: 'self'});    
    },

    _saveRecord: function (recordID, options) {
        if (this.model.isNew(this.handle) && this.canBeSaved()) {
            var _super = this._super.bind(this, recordID, options);
            var buttons = [
                {
                    text: _t("Create"),
                    classes: 'btn-primary o_adyen_confirm',
                    close: true,
                    disabled: true,
                    click: function () {
                        this.close();
                        _super();
                    },
                }, {
                    text: _t("Cancel"),
                    close: true,
                }
            ];

            var dialog = new Dialog(this, {
                size: 'extra-large',
                buttons: buttons,
                title: _t("Confirm your Odoo Payments Account Creation"),
                $content: QWeb.render('AdyenAccountCreationConfirmation', {
                    data: this.model.get(this.handle).data,
                }),
            });

            dialog.open().opened(function () {
                dialog.$el.on('change', '.opt_in_checkbox', function (ev) {
                    ev.preventDefault();
                    dialog.$footer.find('.o_adyen_confirm')[0].disabled = !ev.currentTarget.checked;
                });
            });
        } else if (!this.model.isNew(this.handle)) {
            return this._super.apply(this, arguments);
        }
    },
});

const AdyenAccountFormView = FormView.extend({
    config: _.extend({}, FormView.prototype.config, {
        Controller: AdyenAccountFormController,
    }),
});

viewRegistry.add('adyen_account_form', AdyenAccountFormView);

});
