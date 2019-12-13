odoo.define('stock.StockPickingPopoverScheduling', function (require) {
"use strict";

var core = require('web.core');
var PopoverAbstract = require('stock.PopoverAbstract');
var widgetRegistry = require('web.widget_registry');

var _t = core._t;

var StockPickingPopoverScheduling = PopoverAbstract.extend({
    icon: 'fa fa-info-circle',
    title: _t('Reschedule'),
    color: 'text-warning',
    popoverTemplate: 'stock.StockPickingSchedule',

    _willRender: function () {
        this.hide = !this.data.will_be_late;
    },

    _setPopOver: function () {
        this._super();
        var self = this;
        this.$popover.find('.o_stock_popover_reschedule').on('click', function (ev) {
            ev.stopPropagation();
            self._rpc({
                model: 'stock.picking',
                method: 'action_reschedule',
                args: [[self.data.id]]
            }).then(function () {
                self.trigger_up('reload');
            });
        });

        this.$popover.find('.o_stock_popover_previous_stock_picking').on('click', function (ev) {
            ev.stopPropagation();
            self.do_action({
                name: self.data.previous_stock_picking_id.data.display_name,
                res_model: 'stock.picking',
                res_id: self.data.previous_stock_picking_id.data.id,
                views: [[false, 'form']],
                type: 'ir.actions.act_window',
                view_mode: 'form',
            });
        });
    },
});

widgetRegistry.add('stock_picking_popover_scheduling', StockPickingPopoverScheduling);

return StockPickingPopoverScheduling;
});
