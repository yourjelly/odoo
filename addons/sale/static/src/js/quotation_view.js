odoo.define('sale.quotation_view', function (require) {
'use strict';

    var ajax = require('web.ajax');
    var QuotationPayment = require('payment.payment_method');

    $(document).ready(function () {
        if($("#online_qoutation_payment").length){
            var quotation_payment = new QuotationPayment();
            quotation_payment.attachTo($("#online_qoutation_payment"));
        }

        if($(".o_quote_report_html").length){
            var href = $(location).attr("href"),
                payment_request_id = href.match(/quote\/([0-9]+)/),
                access_token = href.match(/quote\/([^\/?]*)/),
                params = {};

            params.token = access_token ? access_token[1] : '';
            params.payment_request_id = payment_request_id ? payment_request_id[1] : '';
            ajax.jsonRpc('/quote/report/html', 'call', params).then(function (data) {
                var $iframe = $('iframe#print_quote')[0];
                $iframe.contentWindow.document.open('text/htmlreplace');
                $iframe.contentWindow.document.write(data);
            });
        }
        $('a#print_quote_iframe').on('click', function(event){
            event.preventDefault();
            event.stopPropagation();
            $('iframe#print_quote')[0].contentWindow.print();
        });
    });
});
