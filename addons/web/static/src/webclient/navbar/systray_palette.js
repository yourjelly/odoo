/** @odoo-module **/

import { registry } from "@web/core/registry";
import { Component, useService } from "@odoo/owl";

const systrayRegistry = registry.category("systray");

export class SystrayPaletteShortcut extends Component {
    openPalette() {
        console.log("hi!");
        this.env.services.command.openMainPalette();
    }
}


Object.assign(SystrayPaletteShortcut, {
    template: "web.NavBar.PaletteShortcut",
});

systrayRegistry.add(
    "web.PaletteShortcut",
    { Component: SystrayPaletteShortcut },
    { sequence: 20 }
);