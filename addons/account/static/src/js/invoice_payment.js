odoo.define('account.payment_method', function (require) {
    'use strict';

    var ajax = require('web.ajax');

    $(document).ready(function(){
        debugger;
        var $payment = $("#payment_method");
        $payment.on("click", "input[name='acquirer'], a.btn_payment_token", function (ev) {
            var ico_off = 'fa-circle-o',
                ico_on = 'fa-dot-circle-o',
                payment_id = $(ev.currentTarget).val() || $(this).data('acquirer'),
                token = $(ev.currentTarget).data('token') || '';

            $("div.o_invoice_payment_acquirer_button[data-id='"+payment_id+"']", $payment).attr('data-token', token);
            $("div.js_payment a.list-group-item").removeClass("list-group-item-info");
            $('span.js_radio').switchClass(ico_on, ico_off, 0);
            if (token) {
                $("div.o_invoice_payment_acquirer_button div.token_hide").hide();
                $(ev.currentTarget).find('span.js_radio').switchClass(ico_off, ico_on, 0);
                $(ev.currentTarget).parents('li').find('input').prop("checked", true);
                $(ev.currentTarget).addClass("list-group-item-info");
            }
            else {
                $("div.o_invoice_payment_acquirer_button div.token_hide").show();
            }

            $("div.o_invoice_payment_acquirer_button[data-id]", $payment).addClass("hidden");
            $("div.o_invoice_payment_acquirer_button[data-id='"+payment_id+"']", $payment).removeClass("hidden");
        })
        .find("input[name='acquirer']:checked").click();

        // When clicking on payment button: create the tx using json then continue to the acquirer
        $('.o_invoice_payment_acquirer_button').on("click", 'button[type="submit"],button[name="submit"]', function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            var $form = $(ev.currentTarget).parents('form'),
                acquirer = $(ev.currentTarget).parents('div.o_invoice_payment_acquirer_button').first(),
                acquirer_id = acquirer.data('id'),
                acquirer_token = acquirer.attr('data-token'),
                params = {'tx_type': acquirer.find('input[name="odoo_save_token"]').is(':checked')?'form_save':'form'};

            if (! acquirer_id) {
                return false;
            }
            if (acquirer_token) {
                params.token = acquirer_token;
            }
            $form.off('submit');
            var href = $(location).attr("href"),
                payment_request_id = href.match(/payment\/([0-9]+)/),
                access_token = href.match(/payment\/([^\/?]*)/);

            params.access_token = access_token ? access_token[1] : '';
            params.payment_request_id = payment_request_id ? payment_request_id[1] : '';
            ajax.jsonRpc('/invoice/payment/transaction/' + acquirer_id, 'call', params, {}).then(function (data) {
                $(data).appendTo('body').submit();
            });
            return false;
        });

        $('div.o_pay_token').on('click', 'a.js_btn_valid_tx', function() {
            $('div.js_token_load').toggle();
            var $form = $(this).parents('form');
            ajax.jsonRpc($form.attr('action'), 'call', $.deparam($form.serialize())).then(function (data) {
                if (data.url) {
                    window.location = data.url;
                }
                else {
                    $('div.js_token_load').toggle();
                    if (!data.success && data.error) {
                        $('div.o_pay_token div.panel-body p').html(data.error + "<br/><br/>" + _('Retry ? '));
                        $('div.o_pay_token div.panel-body').parents('div').removeClass('panel-info').addClass('panel-danger');
                    }
                }
            });
        });
    });
});
