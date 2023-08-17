/** @odoo-module **/

import { Dialog } from '@web/core/dialog/dialog';
import { useService } from "@web/core/utils/hooks";
import {Component, onMounted, useState, markup} from '@odoo/owl';
import { _t } from "@web/core/l10n/translation";
const { DateTime } = luxon;

class HtmlHistoryDialog extends Component {
    static template = "web_editor.HtmlHistoryDialog";
    static components = { Dialog };
    static props = {
        close: Function,
        restoreRequested: Function,
        recordsIds: Array,
        versionnedFieldName: String,
    };

    state = useState({
        revisionsData: [],
        revisionContent: null,
        revisionComparison: null,
        revisionId: null,
        asyncPending: true,
    });
    setup() {
        this.size = 'xl';
        this.title = _t("History");
        this.orm = useService("orm");

        this.revisionContentCache = {};
        this.revisionComparisonCache = {};

        onMounted(() => this.init());
    }

    async init() {
        await this.getRecordData();
        this.state.asyncPending = false;
        await this.updateCurrentRevision(
            this.state.revisionsData[0].id);
    }

    async getRecordData(limit=100, offset=0) {
        // limit the number of record and order them by id desc
        // const recIds = this.props.recordsIds.slice(0, limit).reverse();
        //
        // // get record data
        // this.state.revisionsData = await this.orm.call(
        //     'field.html.history.revision',
        //     'read',
        //     [recIds, ["id", "create_date", "create_uid"]]
        // );
        this.state.revisionsData = await this.orm.call(
            "field.html.history.revision",
            "search_read",
            [],
            {
                fields: ["id", "create_date", "create_uid"],
                domain: [
                    ["id", "in", this.props.recordsIds],
                    ["res_field", "=", this.props.versionnedFieldName]
                ],
                offset: offset,
                limit: limit,
            }
        );
        console.log("this.state.revisionsData", this.state.revisionsData);
    }

    async updateCurrentRevision(revisionId) {
        if (this.state.currentId === revisionId || this.state.asyncPending) {
            return;
        }
        this.state.asyncPending = true;
        this.state.revisionId = revisionId;
        this.state.revisionComparison = await this.getRevisionComparison(
            revisionId);
        this.state.revisionContent = await this.getRevisionContent(revisionId);
        this.state.asyncPending = false;
    }

    async getRevisionComparison(revisionId) {
        if (!this.revisionComparisonCache[revisionId]) {
            const comparison = await this.orm.call(
                "field.html.history.revision",
                "get_comparison",
                [revisionId]
            );
            console.log('comparison', comparison);
            this.revisionComparisonCache[revisionId] = markup(comparison);
        }
        return this.revisionComparisonCache[revisionId];
    }

    async getRevisionContent(revisionId) {
        if (!this.revisionContentCache[revisionId]) {
            const content = await this.orm.call(
                "field.html.history.revision",
                "get_content",
                [revisionId]
            );
            console.log('content', content);
            this.revisionContentCache[revisionId] = markup(content);
        }
        return this.revisionContentCache[revisionId];
    }

    async _onRestoreRevisionClick() {
        this.state.buttonDisabled = true;
        await this.restoreRevision(this.state.revisionId);
        this.props.close();
    }
    async restoreRevision(revisionId) {
        const restoredContent = await this.getRevisionContent(revisionId);
        this.props.restoreRequested(restoredContent);
    }

    /**
     * Getters
     **/
    getRevisionAuthor(rec) {
        if (rec.create_uid && rec.create_uid[1]) {
            return rec.create_uid[1];
        }
        return 'Unknown';
    }

    getRevisionDate(rec) {
        const now = DateTime.now();
        const today = now.toLocaleString(DateTime.DATE_FULL);
        const yesterday = now.minus({ days: 1 })
            .toLocaleString(DateTime.DATE_FULL);

        const date = DateTime.fromSQL(rec.create_date);
        let dateDay = date.toLocaleString(DateTime.DATE_FULL);

        // if the date is today, we display "Today" instead of the date
        // if the date is yesterday, we display "Yesterday" instead of the date
        if (dateDay === today) {
            dateDay = _t("Today");
        } else if (dateDay === yesterday) {
            dateDay = _t("Yesterday");
        }

        const dateHour = date.toLocaleString(DateTime.TIME_SIMPLE);
        return dateDay + ", " + dateHour;
    }
}
export default HtmlHistoryDialog;
