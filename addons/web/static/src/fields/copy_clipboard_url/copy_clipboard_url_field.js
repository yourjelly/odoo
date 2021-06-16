/** @odoo-module **/

import { registry } from "@web/core/registry";

const { Component } = owl;

export class CopyClipboardUrlField extends Component {}
CopyClipboardUrlField.template = "web.CopyClipboardUrlField";

// registry.category("fields").add("CopyClipboardURL", CopyClipboardUrlField);
registry.category("fields").add("copy_clipboard_url", CopyClipboardUrlField);
