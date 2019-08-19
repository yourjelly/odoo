odoo.define('pos_star_cloud.Printer', function (require) {
"use strict";

var Session = require('web.Session');
var core = require('web.core');

var StarPrinter = core.Class.extend(PrinterMixin, {
    init: function (url, pos) {
        PrinterMixin.init.call(this, arguments);
        this.pos = pos;
    },

    /**
     * @override.
     */
    open_cashbox: function () {
    },

    /**
     * @override
     */
    send_printing_job: function (img) {
        return this._rpc({route: '/star_print_receipt', params: {
            receipt: img,
            pos_session: '111'
        }});
    },
});

return StarPrinter;

});
