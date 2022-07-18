odoo.define('l10n_ke_edi_total.action_post_send_invoice', function (require) {
    const core = require('web.core');
    const ajax = require('web.ajax');
    const Dialog = require('web.Dialog');
    var rpc = require('web.rpc');
    var _t = core._t;

    /* TODO: rewrite error keys */
    function get_drive_error(value) {
        switch(value) {
           case 'no_pykcs11': return _t("Missing library - Please make sure that PyKCS11 is correctly installed on the local proxy server");
           case 'missing_dll': return _t("Missing Dependency - If you are using Windows, make sure eps2003csp11.dll is correctly installed. You can download it here: https://www.egypttrust.com/en/downloads/other-drivers. If you are using Linux or macOS, please install OpenSC");
           case 'no_drive': return _t("No drive found - Make sure the thumb drive is correctly inserted");
           case 'multiple_drive': return _t("Multiple drive detected - Only one secure thumb drive can be inserted at the same time");
           case 'system_unsupported': return _t("System not supported");
           case 'unauthorized': return _t("Unauthorized");
        }
        return _t("Unexpected error:") + value;

    }

    async function action_post_send_invoice(parent, {params}) {
        /*const host = params.sign_host;
        const drive_id = params.drive_id;
        delete params.sign_host;
        delete params.drive_id;  TODO: check */
        await ajax.post('http://localhost:8069' + '/hw_l10n_ke_total/send', params).then(function (res) {
            const res_obj = JSON.parse(res);
            if (res_obj.error) {
                Dialog.alert(this, get_drive_error(res_obj.error));
            } else if (res_obj.invoices) {
                rpc.query({
                    model: 'account.move',
                    method: 'l10n_ke_set_response_data',
                    args: [[], res_obj.invoices],
                }).then(function () {
                    parent.services.action.doAction({
                        'type': 'ir.actions.client',
                        'tag': 'reload',
                    });
                }, function () {
                    Dialog.alert(this, _t("Error trying to connect to Odoo. Check your internet connection"));
                })

            } else {
                Dialog.alert(this, _t('An unexpected error has occurred'));
            }
        }, function () {
            Dialog.alert(this, _t("Error trying to connect to the middleware. Is the middleware running?"));
        })
    }

    core.action_registry.add('action_post_send_invoice', action_post_send_invoice);

    return action_post_send_invoice;
});
