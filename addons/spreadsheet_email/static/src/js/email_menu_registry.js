/** @odoo-module **/

import spreadsheet from "@documents_spreadsheet/js/o_spreadsheet/o_spreadsheet_loader";
const { topbarMenuRegistry } = spreadsheet.registries;
import { _lt } from "web.core";

topbarMenuRegistry.addChild("email", ["file"], {
    name: _lt("Send via Email"),
    sequence: 20,
    action: (env) => env.email(),
});