odoo.define('website.s_ras', function (require) {
'use strict';

const publicWidget = require('web.public.widget');

const CountWidget = publicWidget.Widget.extend({
    selector: '.s_count',
    events: {
        'click .plus': '_onPlusClick',
        'click .minus': '_onMinusClick',
        'click .reset': '_onResetClick',
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
    },
    _onResetClick: function () {
        if (this.resultEL.innerHTML != 0) {
            this.resultEL.innerHTML = 0;
        } else {
            alert("No need to reset! Thanks")
        }
    },
});

publicWidget.registry.CountWidget = CountWidget;

return CountWidget;
});
