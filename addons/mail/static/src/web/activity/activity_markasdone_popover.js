/* @odoo-module */

import { useMessaging } from "@mail/core/messaging_hook";
import { Component, onMounted, useExternalListener, useRef } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

export class ActivityMarkAsDone extends Component {
    static template = "mail.ActivityMarkAsDone";
    static props = ["activity", "close?", "hasHeader?", "onClickDoneAndScheduleNext?", "reload?"];
    static defaultProps = {
        hasHeader: false,
    };

    get isSuggested() {
        return this.props.activity.chaining_type === "suggest";
    }

    setup() {
        this.services = {
            "mail.messaging": useMessaging(),
            "mail.chatter": useService("mail.chatter"),
            "mail.thread": useService("mail.thread"),
            "mail.thread.message_fetch": useService("mail.thread.message_fetch"),
        };
        this.textArea = useRef("textarea");
        onMounted(() => {
            this.textArea.el.focus();
        });
        useExternalListener(window, "keydown", this.onKeydown);
    }

    onKeydown(ev) {
        if (ev.key === "Escape" && this.props.close) {
            this.props.close();
        }
    }

    async onClickDone() {
        const { res_id: resId, res_model: resModel } = this.props.activity;
        const thread = this.services["mail.chatter"].getThread(resModel, resId);
        await this.env.services["mail.activity"].markAsDone(this.props.activity);
        if (this.props.reload) {
            this.props.reload(this.props.activity.res_id, ["activities"]);
        }
        await this.services["mail.thread.message_fetch"].fetchNewMessages(thread);
    }

    async onClickDoneAndScheduleNext() {
        const { res_id: resId, res_model: resModel } = this.props.activity;
        const thread = this.services["mail.chatter"].getThread(resModel, resId);
        if (this.props.onClickDoneAndScheduleNext) {
            this.props.onClickDoneAndScheduleNext();
        }
        if (this.props.close) {
            this.props.close();
        }
        const action = await this.env.services.orm.call(
            "mail.activity",
            "action_feedback_schedule_next",
            [[this.props.activity.id]],
            {
                feedback: this.props.activity.feedback,
            }
        );
        this.services["mail.thread.message_fetch"].fetchNewMessages(thread);
        if (this.props.reload) {
            this.props.reload(this.props.activity.res_id, ["activities", "attachments"]);
        }
        if (!action) {
            return;
        }
        await new Promise((resolve) => {
            this.env.services.action.doAction(action, {
                onClose: resolve,
            });
        });
        if (this.props.reload) {
            this.props.reload(this.props.activity.res_id, ["activities"]);
        }
    }
}
