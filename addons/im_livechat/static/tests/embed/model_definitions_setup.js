/* @odoo-module */

import {
    addModelNamesToFetch,
    insertModelFields,
} from "@bus/../tests/helpers/model_definitions_helpers";

addModelNamesToFetch([
    "chatbot.script",
    "chatbot.script.answer",
    "chatbot.script.step",
    "im_livechat.channel",
    "im_livechat.channel.rule",
]);
insertModelFields("res.users", { im_status: { default: "online" } });
