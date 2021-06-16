/** @odoo-module **/

import { registry } from "@web/core/registry";

const { Component } = owl;

export class PdfViewerField extends Component {}
PdfViewerField.template = "web.PdfViewerField";

registry.category("fields").add("pdf_viewer", PdfViewerField);
