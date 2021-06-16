/** @odoo-module **/

import { registry } from "@web/core/registry";

const { Component } = owl;

export class Many2OneBarcodeField extends Component {}
Many2OneBarcodeField.template = "web.Many2OneBarcodeField";

registry.category("fields").add("many2one_barcode", Many2OneBarcodeField);
