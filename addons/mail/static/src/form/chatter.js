/** @odoo-module */

import { Thread } from "../thread/thread";
import { useMessaging } from "../messaging_hook";
import { Composer } from "../composer/composer";
import { ActivityList } from "../activity/activity_list";
import { Component, useState, onWillUpdateProps, useChildSubEnv } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

export class Chatter extends Component {
    static template = "mail.chatter";
    static components = { Thread, Composer, ActivityList };
    static props = ["hasActivity", "resId", "resModel", "displayName"];

    setup() {
        this.messaging = useMessaging();
        this.activity = useService("mail.activity");
        this.rpc = useService("rpc");
        this.action = useService("action");
        this.state = useState({
            composing: false, // false, 'message' or 'note
            activities: [],
            attachments: [],
            followers: [],
            isFollower: false,
        });

        this.load();
        useChildSubEnv({ inChatter: true });

        onWillUpdateProps((nextProps) => {
            if (nextProps.resId !== this.props.resId) {
                this.load(nextProps.resId);
                if (nextProps.resId === false) {
                    this.state.composing = false;
                }
            }
        });
    }
    load(resId = this.props.resId) {
        const thread = this.messaging.getChatterThread(this.props.resModel, resId);
        this.thread = thread;
        if (!resId) {
            // todo: reset activities/attachments/followers
            return;
        }
        const requestList = ["followers", "attachments", "messages"];
        if (this.props.hasActivity) {
            requestList.push("activities");
        }
        this.rpc("/mail/thread/data", {
            request_list: requestList,
            thread_id: resId,
            thread_model: this.props.resModel,
        }).then((result) => {
            if (this.thread.id === thread.id) {
                this.state.activities = result.activities;
                this.state.attachments = result.attachments;
                this.state.followers = result.followers;
                const partnerId = this.messaging.user.partnerId;
                this.state.isFollower = !!result.followers.find((f) => f.partner_id === partnerId);
            }
        });
    }

    toggleComposer(mode = false) {
        if (this.state.composing === mode) {
            this.state.composing = false;
        } else {
            this.state.composing = mode;
        }
    }

    async scheduleActivity() {
        await this.activity.scheduleActivity(this.props.resModel, this.props.resId);
        this.load();
    }
}
