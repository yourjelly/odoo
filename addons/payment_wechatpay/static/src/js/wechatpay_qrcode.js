odoo.define('payment_wechatpay.qrcode', function (require) {
"use strict";

var payment = require('payment.payment_form');
var ajax = require('web.ajax');
var core = require('web.core');
var Dialog = require('web.Dialog');
var QWeb = core.qweb;
var _t = core._t;

ajax.loadXML("/payment_wechatpay/static/src/xml/qrcode.xml", QWeb);

payment.include({

    payEvent: function (ev) {
        var checked_radio = this.$('input[type="radio"]:checked');
        if (checked_radio[0].dataset.provider == 'wechatpay') {
            var self = this;
            ev.target.disabled = true;
            var $loader = '<div class="wechat_container text-center text-muted">'+
                            '<i class="fa fa-circle-o-notch fa-4x fa-spin"></i>'+
                        '</div>';
            $($loader).appendTo(self.$el);
            this.def = $.Deferred();
            this._super.apply(this, arguments);
            this.def.then( function() {
                new Dialog(self, {
                    title: ('WeChat Payment'),
                    buttons: [{text: _t("Close"),classes : "btn-primary close_qrcode", close: true, click: function () {
                    ev.target.disabled = false;
                }}],
                    $content: QWeb.render('wechatpay.qrcode', {image: $('input[name="wechatpay_qrcode"]').val()}),
                }).open();
                self.$el.find('.wechat_container').remove()
            })
        } else {
            this._super.apply(this, arguments);
        }
    },
});
});
