/** @odoo-module **/

import { browser } from "@web/core/browser/browser";
import { _lt } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/service_hook";

const { Component } = owl;
const { xml } = owl.tags;

class CopiedMessage extends Component {}
CopiedMessage.template = xml`<span class="p-2">Copied !</span>`;

export class CopyClipboardCharField extends Component {
    setup() {
        this.popover = useService("popover");
    }

    async copy() {
        await browser.navigator.clipboard.writeText((this.props.value || "").trim());
        const remove = this.popover.add(this.el, CopiedMessage, {}, { position: "right" });
        browser.setTimeout(remove, 800);
    }
}
CopyClipboardCharField.template = "web.CopyClipboardCharField";

CopyClipboardCharField.description = _lt("Copy to Clipboard");
CopyClipboardCharField.supportedFieldTypes = ["char"];

// registry.category("fields").add("CopyClipboardChar", CopyClipboardCharField);
registry.category("fields").add("copy_clipboard_char", CopyClipboardCharField);
