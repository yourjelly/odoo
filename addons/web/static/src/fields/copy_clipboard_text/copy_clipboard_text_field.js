/** @odoo-module **/

import { registry } from "@web/core/registry";

const { Component } = owl;

export class CopyClipboardTextField extends Component {}
CopyClipboardTextField.template = "web.CopyClipboardTextField";

// registry.category("fields").add("CopyClipboardText", CopyClipboardTextField);
registry.category("fields").add("copy_clipboard_text", CopyClipboardTextField);
