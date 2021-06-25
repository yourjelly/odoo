/** @odoo-module **/

import { useClickAway } from "@web/core/click_away_hook";
import { Dialog } from "@web/core/dialog/dialog";
import { CommandPalette } from "./command_palette";

/**
 * @typedef {import("./command_service").Command} Command
 */

export class CommandPaletteDialog extends Dialog {
    setup() {
        super.setup();
        useClickAway(this.close, { container: "container" });
    }
}
CommandPaletteDialog.renderHeader = false;
CommandPaletteDialog.renderFooter = false;
CommandPaletteDialog.contentClass = "o_command_palette";
CommandPaletteDialog.bodyTemplate = "web.CommandPaletteDialogBody";
CommandPaletteDialog.components = Object.assign({}, Dialog.components, { CommandPalette });
CommandPaletteDialog.props = {
    commands: { type: Array, element: { type: Object } },
    close: Function,
};
