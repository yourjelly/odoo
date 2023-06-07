/* @odoo-module */

import { registry } from "@web/core/registry";
import { _lt } from "@web/core/l10n/translation";

const commandRegistry = registry.category("discuss.channel_commands");

commandRegistry
    .add("help", {
        help: _t("Show a helper message"),
        methodName: "execute_command_help",
    })
    .add("leave", {
        help: _t("Leave this channel"),
        methodName: "execute_command_leave",
    })
    .add("who", {
        channel_types: ["channel", "chat", "group"],
        help: _t("List users in the current channel"),
        methodName: "execute_command_who",
    });
