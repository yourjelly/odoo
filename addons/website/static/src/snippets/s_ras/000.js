odoo.define('website.s_ras', function (require) {
'use strict';

const publicWidget = require('web.public.widget');

const CountWidget = publicWidget.Widget.extend({
    selector: '.s_count',

    /**
     * @override
     */
    start: function () {
       debugger;
    },
});

publicWidget.registry.CountWidget = CountWidget;

return CountWidget;
});
