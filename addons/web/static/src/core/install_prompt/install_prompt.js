/** @odoo-module **/

import { Component } from "@odoo/owl";
import { Dialog } from "@web/core/dialog/dialog";

export class InstallPrompt extends Component {
    static props = {
        close: true,
        title: true,
        onConfirm: { type: Function },
        onCancel: { type: Function },
        isMobileSafari: { type: Boolean },
    };
    static components = {
        Dialog,
    };
    static template = "web.InstallPrompt";
}
