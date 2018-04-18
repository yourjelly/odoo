odoo.define('mass_mailing.unsubscribe', function (require) {
    'use strict';

    var ajax = require('web.ajax');
    var core = require('web.core');
    require('web.dom_ready');

    var _t = core._t;
    var qweb = core.qweb;

    if (!$('.o_unsubscribe_form').length) {
        return $.Deferred().reject("DOM doesn't contain '.o_unsubscribe_form'");
    }
    var self = this;
    $('#unsubscribe_form').on('submit', function (e) {
        e.preventDefault();

        var email = $("input[name='email']").val();
        var mailing_id = parseInt($("input[name='mailing_id']").val());
        var contact_id = parseInt($("input[name='contact_id']").val());
        var token = $("input[name='token']").val()

        var checked_ids = [];
        $("input[type='checkbox']:checked").each(function (i){
          checked_ids[i] = parseInt($(this).val());
        });

        var unchecked_ids = [];
        $("input[type='checkbox']:not(:checked)").each(function (i){
          unchecked_ids[i] = parseInt($(this).val());
        });
        ajax.jsonRpc('/mail/mailing/unsubscribe', 'call', {
            'opt_in_ids': checked_ids, 
            'opt_out_ids': unchecked_ids, 
            'email': email, 
            'mailing_id': mailing_id, 
            'contact_id': contact_id,
            'token': token})
            .then(function (result) {
                $('.o_unsubscribe_form').html(qweb.render("mass_mailing.unsubscribe_template", {result: true, message: _t("Your mailing preference has been updated successfully!")}));
            })
            .fail(function (err, ev) {
                console.log(ev, err)
                $('.o_unsubscribe_form').html(qweb.render("mass_mailing.unsubscribe_template", {result: false, message: _t(ev.data.message)}));
            });
    });
});
