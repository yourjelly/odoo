/** @odoo-module */

import { orm } from "@web/core/orm";
import { Activity } from "@mail/core/web/activity";
import { patch } from "@web/core/utils/patch";

patch(Activity.prototype, {
    async onClickReschedule() {
        await this.env.services["mail.activity"].rescheduleMeeting(this.props.data.id);
    },
    /**
     * @override
     */
    async unlink() {
        if (this.props.data.calendar_event_id) {
            await orm.call("mail.activity", "unlink_w_meeting", [[this.props.data.id]]);
            this.props.onUpdate();
        } else {
            super.unlink();
        }
    },
});
