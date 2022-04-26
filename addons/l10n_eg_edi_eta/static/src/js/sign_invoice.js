odoo.define('l10n_eg_edi_eta.action_post_sign_invoice', function (require) {
    const core = require('web.core');
    const ajax = require('web.ajax');
    const Dialog = require('web.Dialog');
    var rpc = require('web.rpc');
    var _t = core._t;

    async function action_get_drive_certificate(parent, {params}) {
        const host = params.sign_host;
        const drive_id = params.drive_id;
        delete params.sign_host;
        delete params.drive_id;
        await ajax.post(host + '/hw_l10n_eg_eta/certificate', params).then(function (res) {
            const res_obj = JSON.parse(res);
            if (res_obj.error) {
                Dialog.alert(this, res_obj.error);
            } else if (res_obj.certificate) {
                rpc.query({
                    model: 'l10n_eg_edi.thumb.drive',
                    method: 'set_certificate',
                    args: [[drive_id], res_obj.certificate],
                }).then(function () {
                    parent.services.action.doAction({
                        'type': 'ir.actions.client',
                        'tag': 'reload',
                    });
                }, function () {
                    Dialog.alert(this, _t("Error trying to connect to Odoo. Check your internet connection"));
                })

            } else {
                Dialog.alert(this, 'An unexpected error has occurred');
            }
        }, function () {
            Dialog.alert(this, _t("Error trying to connect to the middleware. Is the middleware running?"));
        })
    }

    async function action_post_sign_invoice(parent, {params}) {
        const host = params.sign_host;
        const drive_id = params.drive_id;
        delete params.sign_host;
        delete params.drive_id;
        await ajax.post(host + '/hw_l10n_eg_eta/sign', params).then(function (res) {
            const res_obj = JSON.parse(res);
            if (res_obj.error) {
                Dialog.alert(this, res_obj.error);
            } else if (res_obj.invoices) {
                rpc.query({
                    model: 'l10n_eg_edi.thumb.drive',
                    method: 'set_signature_data',
                    args: [[drive_id], res_obj.invoices],
                }).then(function () {
                    parent.services.action.doAction({
                        'type': 'ir.actions.client',
                        'tag': 'reload',
                    });
                }, function () {
                    Dialog.alert(this, _t("Error trying to connect to Odoo. Check your internet connection"));
                })

            } else {
                Dialog.alert(this, 'An unexpected error has occurred');
            }
        }, function () {
            Dialog.alert(this, _t("Error trying to connect to the middleware. Is the middleware running?"));
        })
    }

    core.action_registry.add('action_get_drive_certificate', action_get_drive_certificate);
    core.action_registry.add('action_post_sign_invoice', action_post_sign_invoice);

    return action_post_sign_invoice;
});
