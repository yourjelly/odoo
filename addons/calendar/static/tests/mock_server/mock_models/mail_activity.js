import { openView } from "@mail/../tests/mail_test_helpers";
import { fields, models } from "@web/../tests/web_test_helpers";

export class MailActivity extends models.Model {
    _name = "mail.activity";

    name = fields.Char();

    async action_create_calendar_event() {
        await openView({
            res_model: "calendar.event",
            views: [[false, "calendar"]],
        });
        return {
            type: "ir.actions.act_window",
            name: "Meetings",
            res_model: "calendar.event",
            view_mode: "calendar",
            views: [[false, "calendar"]],
            target: "current",
        };
    }
    unlink_w_meeting() {
        const eventIds = this.map((act) => act.calendar_event_id);
        const res = this.unlink(arguments[0]);
        this.env["calendar.event"].unlink(eventIds);
        return res;
    }
}
