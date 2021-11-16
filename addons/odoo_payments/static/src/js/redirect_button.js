odoo.define('odoo_payments.redirect_button', require => {
    'use strict';

    const session = require('web.session');
    const Widget = require('web.Widget');
    const widgetRegistry = require('web.widget_registry');

    const RedirectButton = Widget.extend({
        xmlDependencies: ['/odoo_payments/static/src/xml/adyen_account_templates.xml'],
        template: 'account_creation_redirect_button',
        events: {
            'click': '_onClickRedirectButton',
        },

        //--------------------------------------------------------------------------
        // Handlers
        //--------------------------------------------------------------------------

        /**
         * Retrieve the creation redirect form, insert it in the body, and submit it.
         *
         * Called when clicking on the "Finalize Account Creation" button.
         *
         * @private
         * @param {Event} ev
         * @return {undefined}
         */
        _onClickRedirectButton: async function (ev) {
            ev.preventDefault();

            const redirectFormString = await this._rpc({
                route: '/odoo_payments/get_creation_redirect_form',
                params: {
                    context: session.user_context,
                },
            });
            const $redirectForm = $(redirectFormString).appendTo('body');
            $redirectForm.submit();
        },
    });
    widgetRegistry.add('o_odoo_payments_redirect_button_widget', RedirectButton);
    return RedirectButton;
});