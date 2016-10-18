odoo.define('website_sale.payment', function (require) {
"use strict";

var ajax = require('web.ajax');
var Widget = require('web.Widget');

var WebsiteSalePayment = Widget.extend({
    events: {
        'click input[name="acquirer"], a.btn_payment_token': 'pay_now',
        'click button[type="submit"], button[name="submit"]': 'payment_transaction',
    },

    start: function() {
        this._super.apply(this, arguments);
        this.$("input[name='acquirer']:checked").click();
    },

    get_payment_data: function(){
        return {};
    },

    pay_now: function(ev){
        var self = this,
            ico_off = 'fa-circle-o',
            ico_on = 'fa-dot-circle-o';

        var $acquirer_el = $(ev.currentTarget)

        var payment_id = $acquirer_el.val() || $acquirer_el.data('acquirer');
        var token = $acquirer_el.data('token') || '';
        self.$('div.js_payment a.list-group-item').removeClass("list-group-item-info");
        self.$('span.js_radio').switchClass(ico_on, ico_off, 0);

        if (token) {
            self.$('div.oe_sale_acquirer_button[data-id=' +payment_id+ ']').attr('data-token', token);
            self.$('div.oe_sale_acquirer_button div.token_hide').hide();
            $acquirer_el.find('span.js_radio').switchClass(ico_off, ico_on, 0);
            $acquirer_el.parents('li').find('input').prop("checked", true);
            $acquirer_el.addClass("list-group-item-info");
        }
        else{
            self.$("div.oe_sale_acquirer_button div.token_hide").show();
        }
        self.$('div.oe_sale_acquirer_button[data-id]').addClass("hidden");
        self.$('div.oe_sale_acquirer_button[data-id=' +payment_id+ ']').removeClass("hidden");
    },

    payment_transaction: function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        var $acquirer_el = $(ev.currentTarget)

        var $form = $acquirer_el.parents('form');
        var acquirer = $acquirer_el.parents('div.oe_sale_acquirer_button').first();
        var acquirer_id = acquirer.data('id');
        var acquirer_token = acquirer.attr('data-token'); // !=data
        var params = {'tx_type': acquirer.find('input[name="odoo_save_token"]').is(':checked')?'form_save':'form'};
        if (! acquirer_id) {
            return false;
        }
        if (acquirer_token) {
            params.token = acquirer_token;
        }
        _.extend(params, this.get_payment_data())
        $form.off('submit');
        ajax.jsonRpc('/shop/payment/transaction/' + acquirer_id, 'call', params).then(function (data) {
            $(data).submit();
        });
    },
});

$(document).ready(function (){
    // If option is enable
    if ($("#checkbox_cgv").length) {
        $("#checkbox_cgv").click(function() {
            $("div.oe_sale_acquirer_button").find('input, button').prop("disabled", !this.checked);
        });
    }

    if($("#website_sale_payment").length){
        var website_sale_payment = new WebsiteSalePayment();
        website_sale_payment.attachTo($("#website_sale_payment"));
    }

    $('div.oe_pay_token').on('click', 'a.js_btn_valid_tx', function() {
        $('div.js_token_load').toggle();
        var $form = $(this).parents('form');
        ajax.jsonRpc($form.attr('action'), 'call', $.deparam($form.serialize())).then(function (data) {
            if (data.url) {
                window.location = data.url;
            }
            else {
                $('div.js_token_load').toggle();
                if (!data.success && data.error) {
                    $('div.oe_pay_token div.panel-body p').html(data.error + "<br/><br/>" + _('Retry ? '));
                    $('div.oe_pay_token div.panel-body').parents('div').removeClass('panel-info').addClass('panel-danger');
                }
            }
        });
    });
});

return WebsiteSalePayment;
});
