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
import { ThreadIcon } from "@mail/discuss_app/thread_icon";
import { ImStatus } from "@mail/discuss_app/im_status";
import { isEventHandled } from "@mail/utils/misc";
import { ChannelSelector } from "@mail/discuss_app/channel_selector";
import { _t } from "@web/core/l10n/translation";
import { Dropdown } from "@web/core/dropdown/dropdown";
import { DropdownItem } from "@web/core/dropdown/dropdown_item";

export const MODES = {
    NONE: "",
};

/**
 * @typedef {Object} Props
 * @property {import("@mail/web/chat_window/chat_window_model").ChatWindow} chatWindow
 * @property {boolean} [right]
 * @extends {Component<Props, Env>}
 */
export class ChatWindow extends Component {
    static components = {
        Call,
        Dropdown,
        DropdownItem,
        Thread,
        ChannelSelector,
        Composer,
        ThreadIcon,
        ImStatus,
    };
    static props = ["chatWindow", "right?"];
    static template = "mail.ChatWindow";

    setup() {
        this.MODES = MODES;
        this.store = useStore();
        /** @type {import("@mail/web/chat_window/chat_window_service").ChatWindowService} */
        this.chatWindowService = useState(useService("mail.chat_window"));
        /** @type {import("@mail/core/thread_service").ThreadService} */
        this.threadService = useState(useService("mail.thread"));
        this.rtc = useRtc();
        this.messageEdition = useMessageEdition();
        this.messageHighlight = useMessageHighlight();
        this.messageToReplyTo = useMessageToReplyTo();
        this.state = useState({
            moreActionsExpanded: false,
            /**
             * activeMode:
             *   "member-list": channel member list is displayed
             *   "in-settings": settings is displayed
             *   "add-users": add users is displayed (small device)
             *   "": no action pannel
             */
            activeMode: MODES.NONE,
        });
        this.actionService = useService("action");
        this.ui = useState(useService("ui"));
        this.contentRef = useRef("content");
        useChildSubEnv({
            inChatWindow: true,
            messageHighlight: this.messageHighlight,
        });
    }

    get thread() {
        return this.props.chatWindow.thread;
    }

    get style() {
        const maxHeight = !this.ui.isSmall ? "max-height: 95vh;" : "";
        const textDirection = localization.direction;
        const offsetFrom = textDirection === "rtl" ? "left" : "right";
        const visibleOffset = this.ui.isSmall ? 0 : this.props.right;
        const oppositeFrom = offsetFrom === "right" ? "left" : "right";
        return `${offsetFrom}: ${visibleOffset}px; ${oppositeFrom}: auto; ${maxHeight}`;
    }

    onKeydown(ev) {
        switch (ev.key) {
            case "Escape":
                if (
                    isEventHandled(ev, "NavigableList.close") ||
                    isEventHandled(ev, "Composer.discard")
                ) {
                    return;
                }
                this.close({ escape: true });
                break;
            case "Tab": {
                const index = this.chatWindowService.visible.findIndex(
                    (cw) => cw === this.props.chatWindow
                );
                if (index === 0) {
                    this.chatWindowService.visible[this.chatWindowService.visible.length - 1]
                        .autofocus++;
                } else {
                    this.chatWindowService.visible[index - 1].autofocus++;
                }
                break;
            }
        }
    }

    toggleFold() {
        if (this.ui.isSmall || this.state.moreActionsExpanded) {
            return;
        }
        if (this.props.chatWindow.hidden) {
            this.chatWindowService.makeVisible(this.props.chatWindow);
        } else {
            this.chatWindowService.toggleFold(this.props.chatWindow);
        }
        this.chatWindowService.notifyState(this.props.chatWindow);
    }

    expand() {
        if (this.thread.type === "chatter") {
            this.actionService.doAction({
                type: "ir.actions.act_window",
                res_id: this.thread.id,
                res_model: this.thread.model,
                views: [[false, "form"]],
            });
            this.chatWindowService.close(this.props.chatWindow);
            return;
        }
        this.threadService.setDiscussThread(this.thread);
        this.actionService.doAction(
            {
                type: "ir.actions.client",
                tag: "mail.action_discuss",
                name: _t("Discuss"),
            },
            { clearBreadcrumbs: true }
        );
    }

    close(options) {
        this.chatWindowService.close(this.props.chatWindow, options);
        this.chatWindowService.notifyState(this.props.chatWindow);
    }

    get orderedActions() {
        return this.actions.sort((act1, act2) => act1.sequence - act2.sequence);
    }

    get actions() {
        const acts = [];
        if (
            this.thread?.allowCalls &&
            this.thread !== this.rtc.state.channel &&
            !this.props.chatWindow.hidden
        ) {
            acts.push({
                id: "call",
                name: _t("Start a Call"),
                icon: "fa fa-fw fa-phone",
                onSelect: () => this.rtc.toggleCall(this.props.chatWindow.thread),
                sequence: 10,
            });
        }
        if (this.thread && this.props.chatWindow.isOpen && this.thread.allowOpenInDiscuss) {
            acts.push({
                id: "expand",
                name:
                    this.thread.model === "discuss.channel"
                        ? _t("Open in Discuss")
                        : _t("Open Form View"),
                icon: "fa fa-fw fa-expand",
                onSelect: () => this.expand(),
                sequence: 50,
            });
        }
        acts.push({
            id: "close",
            name: _t("Close Chat Window"),
            icon: "fa fa-fw fa-close",
            onSelect: () => this.close(),
            sequence: 100,
        });
        return acts;
    }

    get moreMenuText() {
        return _t("More actions");
    }

    async onMoreActionsStateChanged(state) {
        await new Promise(setTimeout); // wait for bubbling header
        this.state.moreActionsExpanded = state.open;
    }
}
