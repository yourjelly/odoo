/** @odoo-module **/

import { _lt, _t } from '@web/core/l10n/translation';
import { registry } from "@web/core/registry";
import { Component, onWillUpdateProps, markup} from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { browser } from '@web/core/browser/browser';
import { deserializeDateTime } from "@web/core/l10n/dates";
import { dialogService } from '@web/core/dialog/dialog_service';
import {
    ConfirmationDialog
} from '@web/core/confirmation_dialog/confirmation_dialog';
import { ComparisonDialog } from '@web_editor/widgets/comparison_dialog';

const { DateTime } = luxon;

export class One2ManyHistoryList extends Component {
    setup() {
        this.orm = useService("orm");
        this.dialog = useService("dialog");

        this.updateLatestHistoryDiffs(this.props);
        onWillUpdateProps(this.updateLatestHistoryDiffs.bind(this));
    }

    updateLatestHistoryDiffs(props, limit = 1000) {
        this.historyDiffs = props.record.data["history_diff_ids"];
        this.latestHistoryDiffs = [...this.historyDiffs.records].reverse().slice(0, limit);
    }

    get avatarUrl() {
        return '/web/image?model=res.users&field=avatar_128&id=' + this.props.record.data.create_uid[0];
    }
    get userName() {
        return this.props.record.data.create_uid[1];
    }
    /**
        return a formated version of the day of the provided date
     */
    getDateDay(date) {
        let dateDay = DateTime.fromSQL(date).toLocaleString(DateTime.DATE_FULL);
        if (dateDay === DateTime.now().toLocaleString(DateTime.DATE_FULL)) {
            dateDay = _t("Today");
        }
        return dateDay;
    }

    async restoreVersion(historyDiffId) {
        const restoredVersion = await this.orm.call(
            "field.html.history.diff",
            "get_version",
            [historyDiffId],
            {}
        );
        // todo: find a better way to reference the editor
        const editable = document.querySelector(".note-editable.odoo-editor-editable");
        editable.innerHTML = restoredVersion;
        editable.dispatchEvent(new Event('input', { bubbles: true }));
        editable.focus();

        return restoredVersion;
    }

    async getComparisonAtDiffId(historyDiffId, date) {
        const comparison = await this.orm.call(
            "field.html.history.diff",
            "get_comparison",
            [historyDiffId],
            {}
        );

        let FormatedDate = DateTime.fromSQL(date).toLocaleString(DateTime.DATETIME_MED);
        // open the comparison in a confimation dialog
        this.dialog.add(ComparisonDialog, {
            body: _t("Version from ") + FormatedDate,
            comparisonHtml: markup(comparison),
            confirm: () => this.restoreVersion(historyDiffId)
        });
        return comparison;
    }
}

One2ManyHistoryList.template = "web_editor.One2ManyHistoryList";
One2ManyHistoryList.displayName = _lt("Recent History List");
One2ManyHistoryList.supportedTypes = ["one2many"];

export const one2ManyHistoryList = {
    component: One2ManyHistoryList,
    supportedTypes: ["one2many"],
    relatedFields: [
        { name: "id", type: "int" },
        { name: "diff_size", type: "int" },
        { name: "time_ago", type: "text" },
        { name: "create_date", type: "text" },
        { name: "create_uid", type: "int" },
    ],
};

registry.category("fields").add("recent_history_list", one2ManyHistoryList);
