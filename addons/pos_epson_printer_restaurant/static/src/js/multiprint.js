odoo.define('pos_epson_printer_restaurant.multiprint', function (require) {
"use strict";

const PointOfSaleModel = require('point_of_sale.PointOfSaleModel');
const EpsonPrinter = require('pos_epson_printer.Printer');
const { patch } = require('web.utils');

// The override of create_printer needs to happen after its declaration in
// pos_restaurant. We need to make sure that this code is executed after the
// multiprint file in pos_restaurant.
require('pos_restaurant.PointOfSaleModel');

return patch(PointOfSaleModel.prototype, 'pos_epson_printer_restaurant', {
    _createPrinter: function (config) {
        if (config.printer_type === "epson_epos") {
            return new EpsonPrinter(config.epson_printer_ip);
        } else {
            return this._super(...arguments);
        }
    },
});
});
