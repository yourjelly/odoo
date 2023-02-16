/** @odoo-module **/

import { Dialog } from '@web/core/dialog/dialog';
import { formatDateTime } from '@web/core/l10n/dates';
import { useService } from "@web/core/utils/hooks";
import { memoize } from "@web/core/utils/functions";
import {Component, onMounted, useState, markup} from '@odoo/owl';
import { _t } from "@web/core/l10n/translation";
const { DateTime } = luxon;

class HistoryDialog extends Component {
    static template = "web_editor.HistoryDialog";
    static components = { Dialog };
    static props = {
        close: Function,
        restoreRequested: Function,
        recordIds: Array,
        versionnedFieldName: String,
    };

    state = useState({
        revisionsData: [],
        revisionContent: null,
        revisionComparison: null,
        revisionId: null,
    });
    setup() {
        this.size = 'xl';
        this.title = _t("History");
        this.orm = useService("orm");

        onMounted(() => this.init());
    }

    async init() {
        await this.getRecordData();
        await this.updateCurrentRevision(this.state.revisionsData[0].id);
    }

    async getRecordData(limit=100, offset=0) {
        // limit the number of record and order them by id desc
        this.state.revisionsData = await this.orm.call(
            "field.html.history.revision",
            "search_read",
            [],
            {
                fields: ["id", "create_date", "create_uid"],
                domain: [
                    ["id", "in", this.props.recordIds],
                    ["res_field", "=", this.props.versionnedFieldName]
                ],
                offset: offset,
                limit: limit,
                order: "id desc"
            }
        );
    }

    async updateCurrentRevision(revisionId) {
        if (this.state.currentId === revisionId) {
            return;
        }
        this.env.services.ui.block();
        this.state.revisionId = revisionId;
        this.state.revisionComparison = await this.getRevisionComparison(
            revisionId);
        this.state.revisionContent = await this.getRevisionContent(revisionId);
        this.env.services.ui.unblock();
    }

    getRevisionComparison = memoize(async function getRevisionComparison(revisionId) {
        const comparison = await this.orm.call(
            "field.html.history.revision",
            "get_comparison",
            [revisionId]
        );
        return markup(comparison);
    }.bind(this));

    getRevisionContent = memoize(async function getRevisionContent(revisionId) {
        const content = await this.orm.call(
            "field.html.history.revision",
            "get_content",
            [revisionId]
        );
        return markup(content);
    }.bind(this));

    async _onRestoreRevisionClick() {
        this.env.services.ui.block();
        const restoredContent = await this.getRevisionContent(this.state.revisionId);
        this.props.restoreRequested(restoredContent);
        this.env.services.ui.unblock();
        this.props.close();
    }

    /**
     * Getters
     **/
    getRevisionAuthor(rec) {
        return rec.create_uid?.[1];
    }

    getRevisionDate(rec) {
        return formatDateTime(DateTime.fromSQL(rec.create_date));
    }
}
export default HistoryDialog;
