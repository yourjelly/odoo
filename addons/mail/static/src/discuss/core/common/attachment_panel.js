/* @odoo-module */

import { DateSeparator } from "@mail/core/common/date_separator";
import { ActionPanel } from "@mail/discuss/core/common/action_panel";
import { AttachmentList } from "@mail/core/common/attachment_list";

import { Component, onWillStart, onWillUpdateProps } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";
import { useService } from "@web/core/utils/hooks";
import { useVisible } from "@mail/utils/common/hooks";

/**
 * @typedef {Object} Props
 * @property {import("@mail/model/model").Thread} thread
 */
export class AttachmentPanel extends Component {
    static components = { ActionPanel, AttachmentList, DateSeparator };
    static props = ["thread"];
    static template = "mail.AttachmentPanel";

    setup() {
        this.threadService = useService("mail.thread");
        this.attachmentUploadService = useService("mail.attachment_upload");

        onWillStart(() => {
            this.threadService.fetchMoreAttachments(this.props.thread);
        });

        onWillUpdateProps((nextProps) => {
            if (nextProps.thread.localId !== this.props.thread.localId) {
                this.threadService.fetchMoreAttachments(nextProps.thread);
            }
        });

        const loadOlderState = useVisible("loadOlder", () => {
            if (loadOlderState.isVisible) {
                this.threadService.fetchMoreAttachments(this.props.thread);
            }
        });
    }

    get title() {
        return _t("Attachments");
    }

    /**
     * Get the message to display when nothing is pinned on this thread.
     */
    get emptyMessage() {
        if (this.props.thread.type === "channel") {
            return _t("This channel doesn't have any attachments.");
        } else {
            return _t("This conversation doesn't have any attachments.");
        }
    }

    get attachmentsByDate() {
        const attachmentsByDate = {};
        for (const attachment of this.props.thread.attachments) {
            const attachments = attachmentsByDate[attachment.dateDay] ?? [];
            attachments.push(attachment);
            attachmentsByDate[attachment.dateDay] = attachments;
        }
        return attachmentsByDate;
    }
}
