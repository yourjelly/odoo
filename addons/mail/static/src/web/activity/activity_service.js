/** @odoo-module */

import { Activity } from "@mail/web/activity/activity_model";
import { _t } from "@web/core/l10n/translation";
import { assignDefined } from "@mail/utils/misc";
import { registry } from "@web/core/registry";

export class ActivityService {
    constructor(env, services) {
        this.env = env;
        this.services = {
            /** @type {import("@mail/core/store_service").Store} */
            "mail.store": services["mail.store"],
        };
        this.orm = services.orm;
        this.env.bus.addEventListener(
            "mail.messaging/notification",
            ({ detail: { notification } }) => {
                switch (notification.type) {
                    case "mail.activity/updated":
                        if (notification.payload.activity_created) {
                            this.services["mail.store"].activityCounter++;
                        }
                        if (notification.payload.activity_deleted) {
                            this.services["mail.store"].activityCounter--;
                        }
                        break;
                    default:
                        break;
                }
            }
        );
    }

    /**
     * @param {import("./activity_model").Activity} activity
     * @param {number[]} attachmentIds
     */
    async markAsDone(activity, attachmentIds = []) {
        await this.orm.call("mail.activity", "action_feedback", [[activity.id]], {
            attachment_ids: attachmentIds,
            feedback: activity.feedback,
        });
    }

    async schedule(resModel, resId, activityId = false, defaultActivityTypeId = undefined) {
        const context = {
            default_res_model: resModel,
            default_res_id: resId,
        };
        if (defaultActivityTypeId !== undefined) {
            context.default_activity_type_id = defaultActivityTypeId;
        }
        return new Promise((resolve) => {
            this.env.services.action.doAction(
                {
                    type: "ir.actions.act_window",
                    name: _t("Schedule Activity"),
                    res_model: "mail.activity",
                    view_mode: "form",
                    views: [[false, "form"]],
                    target: "new",
                    context,
                    res_id: activityId,
                },
                { onClose: resolve }
            );
        });
    }

    /**
     * @param {import("./activity_model").Data} data
     * @returns {import("./activity_model").Activity}
     */
    insert(data) {
        const activity =
            this.services["mail.store"].activities[data.id] ??
            new Activity(this.services["mail.store"], data.id);
        if (data.request_partner_id) {
            data.request_partner_id = data.request_partner_id[0];
        }
        assignDefined(activity, data);
        return activity;
    }

    delete(activity) {
        delete this.services["mail.store"].activities[activity.id];
    }
}

export const activityService = {
    dependencies: ["mail.store", "orm"],
    start(env, services) {
        return new ActivityService(env, services);
    },
};

registry.category("services").add("mail.activity", activityService);
