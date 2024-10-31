/** @odoo-module */

import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

import { ResumeX2ManyField, resumeX2ManyField } from "@hr_skills/fields/resume_one2many/resume_one2many";
export class EventResumeX2ManyField extends ResumeX2ManyField {
    setup() {
        super.setup();
        this.action = useService("action");
        this.orm = useService("orm");
        this.eventTypeId = false;
    }

    async onAdd ({context, editable} = {}) {
        if (!this.eventTypeId)
            this.eventTypeId = await this.orm.call("hr.resume.line", "get_event_type_id");
        if (context.default_line_type_id == this.eventTypeId) {
            await this.action.doAction(
                "event_hr_skills.action_resume_select_event",
                {
                    additionalContext: { active_employee_id: this.props.record.resId },
                    onClose: () => {
                        this.props.record.model.load();
                    },
                },

            );
            return;
        }
        return super.onAdd({context, editable});
    }
}

export const eventResumeX2ManyField = {
    ...resumeX2ManyField,
    component: EventResumeX2ManyField,
};

registry.category("fields").add("event_resume_one2many", eventResumeX2ManyField);
