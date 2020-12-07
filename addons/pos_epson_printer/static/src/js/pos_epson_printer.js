odoo.define('pos_epson_printer.pos_epson_printer', function (require) {
    'use strict';

    const { patch } = require('web.utils');
    const EpsonPrinter = require('pos_epson_printer.Printer');
    const PointOfSaleModel = require('point_of_sale.PointOfSaleModel');

    return patch(PointOfSaleModel, 'pos_epson_printer', {
        async load() {
            await this._super(...arguments);
            if (this.data.config.other_devices && this.data.config.epson_printer_ip) {
                this.proxy.printer = new EpsonPrinter(this.data.config.epson_printer_ip, this);
            }
        },
    });
});
