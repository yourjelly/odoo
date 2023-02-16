/** @odoo-module **/

import { _lt } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";
import { Component, onWillUpdateProps } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { browser } from '@web/core/browser/browser';

export class One2ManyHistoryList extends Component {
    setup() {
        this.orm = useService("orm");
        this.latestRecords = this.props.value.records.reverse().slice(0, 8);
        onWillUpdateProps((newProps) => {
            this.latestRecords = newProps.value.records.reverse().slice(0, 8);
        });
    }

    get avatarUrl() {
        return '/web/image?model=res.users&field=avatar_128&id=' + this.rec.data.create_uid[0];
    }
    get userName() {
        return this.rec.data.create_uid[1];
    }

    async restoreVersion(historyDiffId) {
        await this.orm.call(
            'field.html.history.diff',
            "action_restore_version",
            [historyDiffId],
            {}
        );
        browser.location.reload();
    }
}

One2ManyHistoryList.template = "web_editor.One2ManyHistoryList";
One2ManyHistoryList.displayName = _lt("Recent History List");
One2ManyHistoryList.supportedTypes = ["one2many"];

export const one2ManyHistoryList = {
    component: One2ManyHistoryList,
    supportedTypes: ["one2many"],
    fieldsToFetch: [
        { name: "id", type: "int" },
        { name: "diff_size", type: "int" },
        { name: "time_ago", type: "text" },
        { name: "create_date", type: "text" },
        { name: "create_uid", type: "int" },
    ],
};

registry.category("fields").add("recent_history_list", one2ManyHistoryList);
