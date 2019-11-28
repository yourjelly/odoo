odoo.define('stock.LeadDaysWidget', function (require) {
"use strict";

var core = require('web.core');
var QWeb = core.qweb;

var Widget = require('web.Widget');
var widget_registry = require('web.widget_registry');

var _t = core._t;
var time = require('web.time');

var LeadDaysWidget = Widget.extend({
    template: 'stock.leadDays',

    /**
     * @override
     * @param {Widget|null} parent
     * @param {Object} params
     */
    init: function (parent, params) {
        this.data = params.data;
        this._super(parent);
    },

    start: function () {
        var self = this;
        return this._super.apply(this, arguments).then(function () {
            self._setPopOver();
        });
    },

    updateState: function (state) {
        this.$el.popover('dispose');
        var candidate = state.data[this.getParent().currentRow];
        if (candidate) {
            this.data = candidate.data;
            this.renderElement();
            this._setPopOver();
        }
    },
    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------
    /**
     * Set a bootstrap popover on the orderpoint widget that display the
     * forecasted stock and its justification.
     */
    _setPopOver: function () {
        this.data.lead_days_date = this.data.lead_days_date.add(this.getSession().getTZOffset(this.data.lead_days_date), 'minutes').format(time.getLangDateFormat());
        var today = new moment();
        this.data.today = today.add(this.getSession().getTZOffset(today), 'minutes').format(time.getLangDateFormat());
        var $content = $(QWeb.render('stock.leadDaysPopOver', {
            data: this.data,
        }));
        var options = {
            content: $content,
            html: true,
            placement: 'left',
            title: _t('Replenishment'),
            trigger: 'focus',
            delay: {'show': 0, 'hide': 100 },
        };
        this.$el.popover(options);
    },
});

widget_registry.add('lead_days_widget', LeadDaysWidget);

return LeadDaysWidget;
});
