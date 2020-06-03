odoo.define('website.s_ras', function (require) {
'use strict';

const publicWidget = require('web.public.widget');

const CountWidget = publicWidget.Widget.extend({
    selector: '.s_count',
    events: {
        'click .plus': '_onPlusClick',
        'click .minus': '_onMinusClick',
    },

    /**
     * @override
     */
    start: function () {
       this.resultEL = this.$el.find('.result')[0];
    },

    _onPlusClick: function () {
        this.resultEL.innerHTML = parseInt(this.resultEL.innerHTML)+1;
    },
    _onMinusClick: function () {
        this.resultEL.innerHTML = parseInt(this.resultEL.innerHTML)-1;
    }
});

publicWidget.registry.CountWidget = CountWidget;

return CountWidget;
});
