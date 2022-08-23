odoo.define('l10n_ke_edi_copycat.action_post_send_invoice', function (require) {
    const core = require('web.core');
    const ajax = require('web.ajax');
    const Dialog = require('web.Dialog');
    var rpc = require('web.rpc');
    var _t = core._t;

    async function action_post_send_invoice(parent, {params}) {
        /*const host = params.sign_host;
        const drive_id = params.drive_id;
        delete params.sign_host;
        delete params.drive_id;  TODO: check */
        const host = params.device_proxy_url;
        console.log(params)
        await ajax.post(host + '/hw_l10n_ke_edi_copycat/forward', params).then(function (res) {
            const res_obj = JSON.parse(res);
            console.log(res_obj);
            if (res_obj.statusCode != "0") {
                Dialog.alert(this, res_obj.statusCode + ": " + res_obj.status);
            } else {
                rpc.query({
                    model: 'account.move',
                    method: 'l10n_ke_set_response_data',
                    args: [[], res_obj],
                }).then(function () {
                    parent.services.action.doAction({
                        'type': 'ir.actions.client',
                        'tag': 'reload',
                    });
                }, function () {
                    Dialog.alert(this, _t("Error trying to connect to Odoo. Check your internet connection"));
                })
            }
        }, function () {
            Dialog.alert(this, _t("Error trying to connect to the middleware. Is the middleware running?"));
        })
    }

    core.action_registry.add('action_post_send_invoice', action_post_send_invoice);

    return action_post_send_invoice;
});
