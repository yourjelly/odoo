/* @odoo-module alias=point_of_sale.env */

// This module is basically web.env but with added fields
// that are specific to point_of_sale and extensions.

import env from 'web.env';
import devices from 'point_of_sale.devices';
import BarcodeReader from 'point_of_sale.BarcodeReader';

// TODO-REF: Move here posbus and posMutex from `point_of_sale.utils`.
const proxy_queue = new devices.JobQueue(); // used to prevent parallels communications to the proxy
const proxy = new devices.ProxyDevice(); // used to communicate to the hardware devices via a local proxy
const barcode_reader = new BarcodeReader({ proxy });

export default Object.assign(env, {
    proxy_queue,
    proxy,
    barcode_reader,
});
