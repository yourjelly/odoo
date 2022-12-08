/* @odoo-module */

import { Component, useState, onWillUpdateProps } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { usePopover } from "@web/core/popover/popover_hook";
import { FileUploader } from "@web/views/fields/file_handler";

import { ActivityMarkAsDone } from "./activity_markasdone_popover";
import { computeDelay } from "@mail/new/utils/dates";
import { useAttachmentUploader } from "../utils/hooks";
import { dataUrlToBlob } from "../utils/misc";

let id = 0;
export class Activity extends Component {
    setup() {
        this.id = id++;
        this.orm = useService("orm");
        this.activity = useService("mail.activity");
        this.state = useState({
            showDetails: false,
        });
        this.popover = usePopover();
        this.delay = computeDelay(this.props.data.date_deadline);
        onWillUpdateProps((nextProps) => {
            this.delay = computeDelay(nextProps.data.date_deadline);
        });
        if (this.props.data.activity_category === "upload_file") {
            this.uploadDocument = useAttachmentUploader({
                threadId: this.env.services["mail.messaging"].getChatterThread(
                    this.props.data.res_model,
                    this.props.data.res_id
                ).id,
            }).upload;
        }
    }

    toggleDetails() {
        this.state.showDetails = !this.state.showDetails;
    }

    async markAsDone(ev) {
        this.popover.add(
            ev.currentTarget,
            ActivityMarkAsDone,
            {
                activity: this.props.data,
                reload: this.props.onUpdate,
            },
            { position: "right" }
        );
    }

    async onFileUploaded({ data, name, type }) {
        const attachmentId = (
            await this.uploadDocument(new File([dataUrlToBlob(data, type)], name, { type }))
        ).id;
        await this.activity.markAsDone(this.props.activity.id, [attachmentId]);
        this.props.onUpdate();
    }

    async edit() {
        const { id, res_model, res_id } = this.props.data;
        await this.activity.scheduleActivity(res_model, res_id, id);
        this.props.onUpdate();
    }

    async unlink() {
        await this.orm.unlink("mail.activity", [this.props.data.id]);
        this.props.onUpdate();
    }
}

Object.assign(Activity, {
    components: { ActivityMarkAsDone, FileUploader },
    props: ["data", "onUpdate?"],
    defaultProps: { onUpdate: () => {} },
    template: "mail.activity",
});
