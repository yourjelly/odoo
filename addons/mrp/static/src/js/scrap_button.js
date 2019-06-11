odoo.define('mrp.StockScrapButton', function (require) {
"use strict";

var ScrapButton = require('stock.StockScrapButton');

ScrapButton.include({

    /**
     *
     * @override
     */
    _getFormFields: function () {
        var fields = this._super.apply(this, arguments);
        fields = fields.concat(['production_id', 'workorder_id']);
        return fields;
    }
});

});
