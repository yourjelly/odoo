/** @odoo-module **/

import { Dialog } from '@web/core/dialog/dialog';
import { useService } from "@web/core/utils/hooks";
import {Component, onMounted, useState, markup} from '@odoo/owl';
import { _t } from 'web.core';
const { DateTime } = luxon;

class HtmlHistoryDialog extends Component {

    state = useState({
        latestHistoryDiffs: [],
        currentHtml: null,
        currentComparisonHtml: null,
        currentId: null,
        buttonDisabled: true,
    });
    setup() {
        this.size = 'xl';
        this.title = _t("Recent History");
        this.orm = useService("orm");

        this.comparisonCache = {};
        this.htmlCache = {};

        onMounted(() => this.init());
    }

    async init(limit=100) {
        // limit the number of record and order them by id desc
        const recIds = this.props.recordsIds.slice(0, limit).reverse();

        // get record data
        this.state.latestHistoryDiffs = await this.orm.call(
            'field.html.history.diff',
            'read',
            [recIds, ["id", "create_date", "create_uid"]]
        );

        // get the comparison html for the latest diff
        this.state.buttonDisabled = false;
        await this.updateCurrentComparisonHtml(this.state.latestHistoryDiffs[0].id);
    }

    async updateCurrentComparisonHtml(historyDiffId) {
        if (this.state.currentId === historyDiffId || this.state.buttonDisabled) {
            return;
        }
        this.state.buttonDisabled = true;
        this.state.currentId = historyDiffId;
        this.state.currentComparisonHtml = await this.getComparisonAtDiffId(historyDiffId);
        this.state.currentHtml = await this.getHtmlAtDiffId(historyDiffId);
        this.state.buttonDisabled = false;
    }

    async getComparisonAtDiffId(historyDiffId) {
        if (!this.comparisonCache[historyDiffId]) {
            const comparison = await this.orm.call(
                "field.html.history.diff",
                "get_comparison",
                [historyDiffId]
            );
            this.comparisonCache[historyDiffId] = markup(comparison);
        }
        return this.comparisonCache[historyDiffId];
    }
    async getHtmlAtDiffId(historyDiffId) {
        if (!this.htmlCache[historyDiffId]) {
            const restoredVersion = await this.orm.call(
                "field.html.history.diff",
                "get_version",
                [historyDiffId]
            );
            this.htmlCache[historyDiffId] = markup(restoredVersion);
        }
        return this.htmlCache[historyDiffId];
    }

    async _onHistoryRestoreClick() {
        this.state.buttonDisabled = true;
        await this.restoreVersion(this.state.currentId);
        this.props.close();
    }
    async restoreVersion(historyDiffId) {
        const restoredVersion = this.getHtmlAtDiffId(historyDiffId);
        this.props.restoreRequested(restoredVersion);
    }

    /**
     * Getters
     **/

    getDiffAuthor(rec) {
        if (rec.create_uid && rec.create_uid[1]) {
            return rec.create_uid[1];
        }
        return 'Unknown';
    }

    getDiffDateDayHour(rec) {
        const date = rec.create_date;
        // if the date is today, we display "Today" instead of the date
        // if the date is yesterday, we display "Yesterday" instead of the date
        let dateDay = DateTime.fromSQL(date).toLocaleString(DateTime.DATE_FULL);
        if (dateDay === DateTime.now().toLocaleString(DateTime.DATE_FULL)) {
            dateDay = _t("Today");
        } else if (dateDay === DateTime.now().minus({ days: 1 }).toLocaleString(DateTime.DATE_FULL)) {
            dateDay = _t("Yesterday");
        }

        const dateHour = DateTime.fromSQL(date).toLocaleString(DateTime.TIME_SIMPLE);
        return dateDay + ", " + dateHour;
    }
}

HtmlHistoryDialog.template = "web_editor.HtmlHistoryDialog";
HtmlHistoryDialog.components = { Dialog };
HtmlHistoryDialog.props = {
    close: Function,
    restoreRequested: Function,
    recordsIds: Array,
};

export default HtmlHistoryDialog;
