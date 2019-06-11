odoo.define('stock.StockScrapButton', function (require) {
"use strict";

var core = require('web.core');
var widgetRegistry = require('web.widget_registry');
var Widget = require('web.Widget');
var ajax = require('web.ajax');
var qweb = core.qweb;

ajax.loadXML('/stock/static/src/xml/stock_scrap_button.xml', qweb)

var ScrapButton = Widget.extend({
    template: "ScrapButton",
    events: {
        'click': '_onScrapButtonClick',
    },

    init: function (parent, record, nodeInfo) {
        this._super.apply(this, arguments);
        this.state = record;
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /*
     * Updates current state, this method is called when any other field is changed
     * update the state so that we have latest updated state and hence latest field values
     *
     */
    updateState: function (state) {
        this.state = state;
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /*
     * Read the given field from state of this widget
     *
     * @private
     */
    _getFieldValue: function (fieldName) {
        var field = this.state.fields[fieldName];
        if (field.type === 'many2one') {
            return this.state.data[fieldName].res_id || false;
        }
        return this.state.data[fieldName];
    },
    /**
     * Returns fields to read, this method can be overriden to extend fields to read
     *
     * @private
     */
    _getFormFields: function () {
        return ['name', 'product_id', 'location_id', 'scrap_location_id', 'package_id',
            'owner_id', 'product_uom_id', 'scrap_qty', 'lot_id'];
    },

    //--------------------------------------------------------------------------
    // Handler
    //--------------------------------------------------------------------------

    /*
     * This method call inventory_data which will check if quantity is is sufficient or not
     * if quantity is insufficient then inventory_data method return action to open
     * insufficient quantity wizard, if quantity is sufficient then it will create the record
     * of scrap and closes this wizard
     *
     * @private
     */
    _onScrapButtonClick: function () {
        var self = this;
        var values = {};
        var fieldToFetch = this._getFormFields();
        _.each(fieldToFetch, function (fieldName) {
            values[fieldName] = self._getFieldValue(fieldName);
        });
        this._rpc({
            model: 'stock.scrap',
            method: 'inventory_data',
            args: [values,],
        }).then(function (result) {
            self.do_action(result);
        });
    },
});
widgetRegistry.add('scrap_button', ScrapButton);

return ScrapButton;
});

