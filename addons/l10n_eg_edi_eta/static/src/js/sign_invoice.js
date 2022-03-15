odoo.define('l10n_eg_edi_eta.action_post_sign_invoice', function (require) {
    const core = require('web.core');

    function action_post_sign_invoice(parent, {params}) {

        const win = window.open(`${params.sign_host}/hw_drivers/sign/login?invoice_ids=${params.invoice_ids}&url=${params.url}&otp=${params.token}`, '_blank', 'height=500,width=400');
        const pollTimer = window.setInterval(function () {
            if (!win.closed) return;
            window.clearInterval(pollTimer);
            parent.services.action.doAction('reload');
        }, 200);
    }

    core.action_registry.add('action_post_sign_invoice', action_post_sign_invoice);

    return action_post_sign_invoice;
});