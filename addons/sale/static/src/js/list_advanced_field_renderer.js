odoo.define('sale.AdvancedFieldListRenderer', function (require) {
"use strict";

/**
 * Advanced Fields List renderer
 *
 */
var core = require('web.core');
var dom = require('web.dom');
var ListRenderer = require('web.ListRenderer');
var utils = require('web.utils');

var _t = core._t;

var AdvancedFieldListRenderer = ListRenderer.include({
    events: _.extend({}, ListRenderer.prototype.events, {
        'click tr .o_list_record_open': '_onOpenAdvancedFieldClick',
    }),
    
    /**
     * @private
     * @returns {integer}
     */
    _getNumberOfCols: function () {
        var n = this._super();
        if (!this.editable) {
            n++;
        }
        return n;
    },

    _renderRow: function (record, index) {
        var $row = this._super.apply(this, arguments);
        if (!this.editable && this.hiddenColumns) {
            var $icon = $('<button>', {class: 'fa fa-caret-square-o-right', name: 'open', 'aria-label': _t('Open ') + (index+1)});
            var $td = $('<td>', {class: 'o_list_record_open'}).append($icon);
            $row.append($td);
        }
        return $row;
    },

    _onOpenAdvancedFieldClick: function (event) {
        event.stopPropagation();
        debugger;
        var $row = $(event.target).closest('tr');
        var id = $row.data('id');
        if (id) {
            /*var action = {
                type: 'ir.actions.act_window',
                res_model: 'sale.order',
                view_mode: 'form',
                view_type: 'form,kanban,tree',
                views: [[false, 'form']],
                target: 'current',
                res_id: $row.data('id')
            };
            this.do_action(action);*/
        }
    },
});

});