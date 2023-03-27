/* @odoo-module */

import { Call } from "@mail/rtc/call";
import { Thread } from "@mail/core_ui/thread";
import { Composer } from "@mail/composer/composer";
import { useStore } from "@mail/core/messaging_hook";
import { useRtc } from "@mail/rtc/rtc_hook";
import { useMessageEdition, useMessageHighlight, useMessageToReplyTo } from "@mail/utils/hooks";
import { Component, useChildSubEnv, useRef, useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { localization } from "@web/core/l10n/localization";
import { CallSettings } from "@mail/rtc/call_settings";
import { ChannelMemberList } from "@mail/discuss/channel_member_list";
import { ThreadIcon } from "@mail/discuss/thread_icon";
import { ChannelInvitation } from "@mail/discuss/channel_invitation";
import { isEventHandled } from "@mail/utils/misc";
import { ChannelSelector } from "@mail/discuss/channel_selector";

/**
 * @typedef {Object} Props
 * @property {import("@mail/web/chat_window/chat_window_model").ChatWindow} chatWindow
 * @property {boolean} [right]
 * @extends {Component<Props, Env>}
 */
export class ChatWindow extends Component {
    static components = {
        Call,
        Thread,
        ChannelSelector,
        Composer,
        CallSettings,
        ChannelMemberList,
        ThreadIcon,
        ChannelInvitation,
    };
    static props = ["chatWindow", "right?"];
    static template = "mail.ChatWindow";

    setup() {
        this.services = {
            "mail.store": useStore(),
            /** @type {import("@mail/web/chat_window/chat_window_service").ChatWindowService} */
            "mail.chat_window": useService("mail.chat_window"),
            /** @type {import("@mail/core/thread_service").ThreadService} */
            "mail.thread": useService("mail.thread"),
            "mail.rtc": useRtc(),
        };
        this.messageEdition = useMessageEdition();
        this.messageHighlight = useMessageHighlight();
        this.messageToReplyTo = useMessageToReplyTo();
        this.state = useState({
            /**
             * activeMode:
             *   "member-list": channel member list is displayed
             *   "in-settings": settings is displayed
             *   "add-users": add users is displayed (small device)
             *   "": no action pannel
             */
            activeMode: "",
        });
        this.action = useService("action");
        this.contentRef = useRef("content");
        useChildSubEnv({ inChatWindow: true });
    }

    get thread() {
        return this.props.chatWindow.thread;
    }

    get style() {
        const textDirection = localization.direction;
        const offsetFrom = textDirection === "rtl" ? "left" : "right";
        const visibleOffset = this.services["mail.store"].isSmall ? 0 : this.props.right;
        const oppositeFrom = offsetFrom === "right" ? "left" : "right";
        return `${offsetFrom}: ${visibleOffset}px; ${oppositeFrom}: auto`;
    }

    onKeydown(ev) {
        switch (ev.key) {
            case "Escape":
                // prevent reopening last app when in home menu
                ev.stopPropagation();
                if (
                    isEventHandled(ev, "NavigableList.close") ||
                    isEventHandled(ev, "Composer.discard")
                ) {
                    return;
                }
                this.close({ escape: true });
                break;
            case "Tab": {
                const index = this.services["mail.chat_window"].visible.findIndex(
                    (cw) => cw === this.props.chatWindow
                );
                if (index === 0) {
                    this.services["mail.chat_window"].visible[
                        this.services["mail.chat_window"].visible.length - 1
                    ].autofocus++;
                } else {
                    this.services["mail.chat_window"].visible[index - 1].autofocus++;
                }
                break;
            }
        }
    }

    toggleFold() {
        if (this.props.chatWindow.hidden) {
            this.services["mail.chat_window"].makeVisible(this.props.chatWindow);
        } else {
            this.services["mail.chat_window"].toggleFold(this.props.chatWindow);
        }
        this.services["mail.chat_window"].notifyState(this.props.chatWindow);
    }

    toggleSettings() {
        this.state.activeMode = this.state.activeMode === "in-settings" ? "" : "in-settings";
    }

    toggleMemberList() {
        this.state.activeMode = this.state.activeMode === "member-list" ? "" : "member-list";
    }

    toggleAddUsers() {
        this.state.activeMode = this.state.activeMode === "add-users" ? "" : "add-users";
    }

    expand() {
        if (this.thread.type === "chatter") {
            this.action.doAction({
                type: "ir.actions.act_window",
                res_id: this.thread.id,
                res_model: this.thread.model,
                views: [[false, "form"]],
            });
            this.services["mail.chat_window"].close(this.props.chatWindow);
            return;
        }
        this.services["mail.thread"].setDiscussThread(this.thread);
        this.action.doAction(
            {
                type: "ir.actions.client",
                tag: "mail.action_discuss",
            },
            { clearBreadcrumbs: true }
        );
    }

    close(options) {
        this.services["mail.chat_window"].close(this.props.chatWindow, options);
        this.services["mail.chat_window"].notifyState(this.props.chatWindow);
    }
}
