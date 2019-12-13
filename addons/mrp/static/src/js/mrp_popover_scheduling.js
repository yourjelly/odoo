odoo.define('mrp.MrpPopoverScheduling', function (require) {
"use strict";

var core = require('web.core');
var PopoverAbstract = require('stock.PopoverAbstract');
var widgetRegistry = require('web.widget_registry');

var _t = core._t;

var MrpPopoverScheduling = PopoverAbstract.extend({
    icon: 'fa fa-info-circle',
    title: _t('Reschedule'),
    trigger: 'focus',
    placement: 'left',
    color: 'text-warning',
    popoverTemplate: 'mrp.popoverContent',

    _willRender: function () {
        this.hide = !this.data.will_be_late;
    },

    _setPopOver: function () {
        this._super();
        var self = this;
        this.$popover.find('.o_mrp_popover_reschedule').on('click', function (ev) {
            ev.stopPropagation();
            self._rpc({
                model: 'mrp.production',
                method: 'action_reschedule',
                args: [[self.data.id]]
            }).then(function () {
                self.trigger_up('reload');
            });
        });

        this.$popover.find('.o_mrp_popover_previous_mo').on('click', function (ev) {
            ev.stopPropagation();
            self.do_action({
                name: self.data.previous_mrp_production_id.data.display_name,
                res_model: 'mrp.production',
                res_id: self.data.previous_mrp_production_id.data.id,
                views: [[false, 'form']],
                type: 'ir.actions.act_window',
                view_mode: 'form',
            });
        });
    },
});

widgetRegistry.add('mrp_popover_scheduling', MrpPopoverScheduling);

return MrpPopoverScheduling;
});
