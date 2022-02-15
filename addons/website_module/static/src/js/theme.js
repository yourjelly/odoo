odoo.define('website_coconuts.CoconutsConsoleLog', function (require) {
'use strict';

var publicWidget = require('web.public.widget');

publicWidget.registry.CoconutsConsoleLog = publicWidget.Widget.extend({
    selector: '#wrapwrap',

    start: function () {
        console.log('Website Module - #01');
        return this._super.apply(this, arguments);
    },
})

});
