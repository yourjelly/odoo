odoo.define('stock.SingletonListController', function (require) {
"use strict";

var core = require('web.core');
var InventoryReportListController = require('stock.InventoryReportListController');

var _t = core._t;

/**
 * The purpose of this override is to avoid to have two or more similar records
 * in the list view.
 *
 * It's used in quant list view, a list editable where when you create a new
 * line about a quant who already exists, we want to update the existing one
 * instead of create a new one, and then we don't want to have two similar line
 * in the list view, so we refresh it.
 */

var SingletonListController = InventoryReportListController.extend({
    buttons_template: 'StockQuant.Buttons',

    // -------------------------------------------------------------------------
    // Public
    // -------------------------------------------------------------------------
    /**
     * @override
     */
    renderButtons: function ($node) {
        this._super.apply(this, arguments);
        if (this.context.no_inventory_buttons) {
            this.$buttons.find('button.o_button_apply_inventory').hide();
            this.$buttons.find('button.o_button_request_count_inventory').hide();
        }
        this.$buttons.on('click', '.o_button_apply_inventory', this._onApplyInventory.bind(this));
        this.$buttons.on('click', '.o_button_request_count_inventory', this._onRequestCountInventory.bind(this));
    },

    // -------------------------------------------------------------------------
    // Private
    // -------------------------------------------------------------------------

    /**
     * @override
     * @return {Promise} rejected when update the list because we don't want
     * anymore to select a cell who maybe doesn't exist anymore.
     */
    _confirmSave: function (id) {
        var newRecord = this.model.localData[id];
        var model = newRecord.model;
        var res_id = newRecord.res_id;

        var findSimilarRecords = function (record) {
            if ((record.groupedBy && record.groupedBy.length > 0) || record.data.length) {
                var recordsToReturn = [];
                for (var i in record.data) {
                    var foundRecords = findSimilarRecords(record.data[i]);
                    recordsToReturn = recordsToReturn.concat(foundRecords || []);
                }
                return recordsToReturn;
            } else {
                if (record.res_id === res_id && record.model === model) {
                    if (record.count === 0){
                        return [record];
                    }
                    else if (record.ref && record.ref.indexOf('virtual') !== -1) {
                        return [record];
                    }
                }
            }
        };

        var handle = this.model.get(this.handle);
        var similarRecords = findSimilarRecords(handle);

        if (similarRecords.length > 1) {
            var notification = _t("You tried to create a record who already exists."+
            "<br/>This last one has been modified instead.");
            this.do_notify(_t("This record already exists."), notification);
            this.reload();
            return Promise.reject();
        }
        else {
            return this._super.apply(this, arguments);
        }
    },

    // -------------------------------------------------------------------------
    // Handlers
    // -------------------------------------------------------------------------

    _onApplyInventory: function (ev) {
        var self = this;
        var ids = this.getSelectedIds();
        if (! ids.length) {
            var modified_records = this.initialState.data.filter(record => record.data.inventory_diff_quantity != 0)
            ids = modified_records.map(record => record.data.id)
        }
        if (ids.length) {
            return this._rpc({
                model: 'stock.quant',
                method: 'action_apply_inventory',
                args: [ids],
                context: this.context,
            }).then((result) => {
                if (! result) {
                    return self.do_action('stock.action_inventory_tree');
                }
                return self.do_action(result);
            })
        }
    },

    /**
     * 
     * @private
     * @param {OdooEvent} ev
     */
    _onButtonClicked: function (ev) {
        ev.stopPropagation();
        var self = this;
        var def;

        return self.saveRecord(ev.data.record.id, {
            stayInEdit: true,
        }).then(function () {
            // we need to reget the record to make sure we have changes made
            // by the basic model, such as the new res_id, if the record is
            // new.
            var record = self.model.get(ev.data.record.id);
            return self._callButtonAction(ev.data.attrs, record);
        }).then(function () {
            self._enableButtons();
        }).guardedCatch(this._enableButtons.bind(this));
    },

    _onRequestCountInventory: function (ev) {
        var ids = this.getSelectedIds();
        var self = this;
        if ( ids.length ) {
            return this._rpc({
                model: 'stock.quant',
                method: 'write',
                args: [ids, { inventory_date: new moment().utc().format() }],
                context: this.context,
            }).then((result) => {
                return self.do_action('stock.action_inventory_tree');
            })
        }
    },
});

return SingletonListController;

});
