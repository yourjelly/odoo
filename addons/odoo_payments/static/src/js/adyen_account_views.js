odoo.define('odoo_payments.account_views', require => {
    'use strict';

    const core = require('web.core');
    const framework = require('web.framework');
    const Dialog = require('web.Dialog');
    const FormController = require('web.FormController');
    const FormView = require('web.FormView');
    const viewRegistry = require('web.view_registry');

    const _t = core._t;
    const QWeb = core.qweb;

    const AdyenAccountFormController = FormController.extend({

        /**
         * Redirect the user to /web if they abort the account creation.
         *
         * @override method from web.BasicController
         * @private
         * @param {string} recordID
         * @param {Object} options
         * @return {Promise}
         */
        _discardChanges: function (recordID, options) {
            // TODO ANVFE see if we can just return super when coming from payment acquirer form
            // FIXME ANVFE this is basically wrong because it makes us leave the form view of a created account
            //  whenever we discard local changes, the redirection should only happen for non-saved accounts
            return this._super(...arguments).then(() => {
                this.do_action({type: 'ir.actions.act_url', url: '/web', target: 'self'});
            });
        },

        /**
         * Upon creating the record, show a the terms and restrictions, and redirect to internal.
         *
         * The record can only be created if the terms and restrictions are accepted by the user.
         * After accepting the terms and restrictions, the user is redirected to internal to
         * finalize the onboarding flow.
         *
         * @override method from web.BasicController
         * @private
         * @param {string} recordID
         * @param {Object} options
         * @return {Promise}
         */
        _saveRecord: function (recordID, options) {
            if (this.model.isNew(this.handle)) { // The record is being created
                if (this.canBeSaved()) { // And all required fields are filled
                    const _super = this._super.bind(this, recordID, options);
                    // Create a dialog to display the terms and restrictions
                    const dialog = new Dialog(this, {
                        title: _t("Confirm your Odoo Payments Account Creation"),
                        buttons: [
                            {
                                text: _t("Create"),
                                classes: 'btn-primary o_odoo_payments_create_account_button',
                                disabled: true, // Require accepting the terms and restrictions
                                click: async () => {
                                    framework.blockUI();
                                    await _super(); // Create the account
                                    await this._submitCreationForm();
                                },
                            },
                            {
                                text: _t("Cancel"),
                                close: true
                            },
                        ],
                        size: 'extra-large',
                        $content: QWeb.render('terms_and_restrictions_dialog', {
                            account_data: this.model.get(this.handle).data,
                        }),
                    });
                    // Enable the confirmation button upon accepting the terms and restrictions
                    dialog.opened(() => {
                        dialog.$el.on('change', '#terms_and_restrictions_checkbox', ev => {
                            ev.preventDefault();
                            dialog.$footer.find('.o_odoo_payments_create_account_button').attr(
                                'disabled', !ev.currentTarget.checked
                            );
                        });
                    });
                    // Show the dialog
                    dialog.open();
                } else {
                    // Don't call super as canBeSaved() has already highlighted the required fields
                }
                return Promise.resolve();
            } else {
                return this._super(...arguments);
            }
        },

        /**
         * Retrieve the creation redirect form, insert it in the body, and submit it.
         *
         * @private
         * @return {undefined}
         */
        _submitCreationForm: async function () {
            const redirectFormString = await this._rpc({
                route: '/odoo_payments/get_creation_redirect_form'
            });
            const $redirectForm = $(redirectFormString).appendTo('body');
            $redirectForm.submit();
        },
    });

    const AdyenAccountFormView = FormView.extend({
        config: _.extend({}, FormView.prototype.config, {
            Controller: AdyenAccountFormController,
        }),
    });

    viewRegistry.add('adyen_account_form_view', AdyenAccountFormView);
});
