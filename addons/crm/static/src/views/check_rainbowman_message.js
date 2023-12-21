/** @odoo-module **/

import { orm } from "@web/core/orm";

export async function checkRainbowmanMessage(effect, recordId) {
    const message = await orm.call("crm.lead", "get_rainbowman_message", [[recordId]]);
    if (message) {
        effect.add({
            message,
            type: "rainbow_man",
        });
    }
}
