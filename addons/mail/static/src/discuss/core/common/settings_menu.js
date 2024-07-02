import { Component, useState } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";
import { ActionPanel } from "@mail/discuss/core/common/action_panel";
import { DiscussNotificationSettings } from "@mail/discuss/core/common/discuss_notification_settings";

export class SettingsMenu extends Component {
    static components = { ActionPanel, DiscussNotificationSettings };
    static template = "discuss.SettingsMenu";
    static props = ["*"];

    get title() {
        return _t("Settings");
    }
}
