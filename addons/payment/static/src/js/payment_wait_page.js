odoo.define('payment.polling_confirmation', function(require) {
    "use strict";
    
    var ajax = require('web.ajax');
    
    $(document).ready(function () {
    
        var _poll_nbr = 0;

        if (!document.getElementById("payment_draft_state")) {
            return;
        }
    
        function payment_transaction_poll_status() {
            return ajax.jsonRpc('/payment/transaction_status', 'call', {
            }).then(function (result) {
                _poll_nbr += 1;
                if(result.recall) {
                        setTimeout(function () { payment_transaction_poll_status(); }, Math.ceil(_poll_nbr < 20 ? _poll_nbr / 3: 6) * 1000);
                } else {
                    location.reload();
                }
            });
        }
    
        payment_transaction_poll_status();
    });
    
    });
    