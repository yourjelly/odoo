/* @odoo-module */

import { DateSection } from "@mail/core/common/date_section";
import { ActionPanel } from "@mail/discuss/core/common/action_panel";
import { AttachmentList } from "@mail/core/common/attachment_list";
import { LinkPreviewList } from "@mail/core/common/link_preview_list";

import { Component, useState, onWillStart, onWillUpdateProps } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { useVisible } from "@mail/utils/common/hooks";

/**
 * @typedef {Object} Props
 * @property {import("models").Thread} thread
 */
export class AttachmentPanel extends Component {
    static components = { ActionPanel, AttachmentList, DateSection, LinkPreviewList };
    static props = ["thread"];
    static template = "mail.AttachmentPanel";

    setup() {
        this.threadService = useService("mail.thread");
        this.attachmentUploadService = useService("mail.attachment_upload");
        this.state = useState({
            current: "media",
            linkPreviews: this.countAttachments("link"),
            media: this.countAttachments("media"),
            files: this.countAttachments("files"),
        });
        onWillStart(() => {
            this.threadService.fetchMoreAttachments(this.props.thread);
        });
        onWillUpdateProps((nextProps) => {
            if (nextProps.thread.notEq(this.props.thread)) {
                this.threadService.fetchMoreAttachments(nextProps.thread);
            }
        });
        const loadOlderState = useVisible("load-older", () => {
            if (loadOlderState.isVisible) {
                this.threadService.fetchMoreAttachments(this.props.thread);
            }
        });
    }

    countAttachments(tab) {
        const messages = this.props.thread.messages.__list__;
        const { attachments } = this.props.thread;
        const allAttachments = Array.from(attachments);
        let length = 0;

        if (tab === "media") {
            allAttachments.forEach((attachment) => {
                if (attachment.isMedia) {
                    length++;
                }
            });
        } else if (tab === "links") {
            messages.forEach((_, i) => {
                const message = this.props.thread.messages[i];
                if (message && message.linkPreviews && message.linkPreviews.length > 0) {
                    length++;
                }
            });
        } else if (tab === "files") {
            allAttachments.forEach((attachment) => {
                if (!attachment.isMedia) {
                    length++;
                }
            });
        }
        return length;
    }

    /**
     * @return {Object<string, import("models").Attachment[]>}
     */
    categorizeAttachmentsByMonthYear = (attachments, filterAttachments) => {
        attachments = Array.from(attachments);
        return attachments.reduce((attachmentsByDate, attachment) => {
            if (filterAttachments(attachment)) {
                const { monthYear } = attachment;
                attachmentsByDate[monthYear] = [
                    ...(attachmentsByDate[monthYear] || []),
                    attachment,
                ];
            }
            return attachmentsByDate;
        }, {});
    };

    categorizedAttachments(type) {
        const { attachments } = this.props.thread;
        const message = this.props.thread.messages.__list__;
        const { thread } = this.props;
        const proxyObject = {};
        message.forEach((_, i) => {
            const message = thread.messages[i];
            if (message && message.linkPreviews && message.linkPreviews.length > 0) {
                proxyObject[i] = message.linkPreviews[0];
            }
        });
        const linkAttachments = Object.values(proxyObject);

        switch (type) {
            case "media":
                this.state.media = this.countAttachments("media");
                return this.categorizeAttachmentsByMonthYear(
                    attachments,
                    (attachment) => attachment.isMedia
                );
            case "link":
                this.state.linkPreviews = this.countAttachments("links");
                return this.categorizeAttachmentsByMonthYear(linkAttachments, () => true);
            case "file":
                this.state.files = this.countAttachments("files");
                return this.categorizeAttachmentsByMonthYear(
                    attachments,
                    (attachment) => !attachment.isMedia
                );
            default:
                return {};
        }
    }

    handleTabSelection = (ev) => {
        (this.state.current =
            ev.target.dataset.tab !== this.state.current
                ? ev.target.dataset.tab
                : this.state.current),
            ev.target.classList.toggle("active", true);
    };
}
