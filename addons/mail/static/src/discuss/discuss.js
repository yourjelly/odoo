/* @odoo-module */

import { AutoresizeInput } from "./autoresize_input";
import { Thread } from "../core_ui/thread";
import { ThreadIcon } from "../discuss/thread_icon";
import { useMessaging, useStore } from "../core/messaging_hook";
import { useRtc } from "../rtc/rtc_hook";
import { useMessageEdition, useMessageHighlight, useMessageToReplyTo } from "@mail/utils/hooks";
import { Composer } from "../composer/composer";
import { Call } from "../rtc/call";
import { ChannelMemberList } from "./channel_member_list";
import {
    Component,
    onWillStart,
    onMounted,
    onWillUnmount,
    useChildSubEnv,
    useRef,
    useState,
    useEffect,
} from "@odoo/owl";
import { CallSettings } from "../rtc/call_settings";
import { usePopover } from "@web/core/popover/popover_hook";
import { useService } from "@web/core/utils/hooks";
import { ChannelInvitation } from "./channel_invitation";
import { _t } from "@web/core/l10n/translation";

export class Discuss extends Component {
    static components = {
        AutoresizeInput,
        Thread,
        ThreadIcon,
        Composer,
        Call,
        CallSettings,
        ChannelMemberList,
    };
    static props = {
        public: { type: Boolean, optional: true },
    };
    static template = "mail.Discuss";

    MODES = Object.freeze({
        MEMBER_LIST: "member-list",
        SETTINGS: "settings",
        NONE: "",
    });

    setup() {
        this.services = {
            "mail.messaging": useMessaging(),
            "mail.store": useStore(),
            "mail.thread": useService("mail.thread"),
            "mail.message": useService("mail.message"),
            "mail.persona": useService("mail.persona"),
            "mail.rtc": useRtc(),
        };
        this.messageHighlight = useMessageHighlight();
        this.messageEdition = useMessageEdition();
        this.messageToReplyTo = useMessageToReplyTo();
        this.contentRef = useRef("content");
        this.popover = usePopover();
        this.closePopover = null;
        this.settingsRef = useRef("settings");
        this.addUsersRef = useRef("addUsers");
        this.state = useState({
            activeMode: this.MODES.NONE,
        });
        this.orm = useService("orm");
        this.effect = useService("effect");
        this.prevInboxCounter = this.services["mail.store"].discuss.inbox.counter;
        useChildSubEnv({ inDiscussApp: true });
        useEffect(
            () => {
                if (
                    this.thread?.id === "inbox" &&
                    this.prevInboxCounter !== this.services["mail.store"].discuss.inbox.counter &&
                    this.services["mail.store"].discuss.inbox.counter === 0
                ) {
                    this.effect.add({
                        message: _t("Congratulations, your inbox is empty!"),
                        type: "rainbow_man",
                        fadeout: "fast",
                    });
                }
                this.prevInboxCounter = this.services["mail.store"].discuss.inbox.counter;
            },
            () => [this.services["mail.store"].discuss.inbox.counter]
        );
        onWillStart(() => this.services["mail.messaging"].isReady);
        onMounted(() => (this.services["mail.store"].discuss.isActive = true));
        onWillUnmount(() => (this.services["mail.store"].discuss.isActive = false));
    }

    markAllAsRead() {
        this.orm.silent.call("mail.message", "mark_all_as_read");
    }

    get thread() {
        return this.services["mail.store"].threads[
            this.services["mail.store"].discuss.threadLocalId
        ];
    }

    toggleInviteForm() {
        if (this.closePopover) {
            this.closePopover();
            this.closePopover = null;
        } else {
            const el = this.addUsersRef.el;
            this.closePopover = this.popover.add(
                el,
                ChannelInvitation,
                { thread: this.thread },
                { onClose: () => (this.closePopover = null) }
            );
        }
    }

    toggleSettings() {
        this.state.activeMode =
            this.state.activeMode === this.MODES.SETTINGS ? this.MODES.NONE : this.MODES.SETTINGS;
    }

    toggleMemberList() {
        this.state.activeMode =
            this.state.activeMode === this.MODES.MEMBER_LIST
                ? this.MODES.NONE
                : this.MODES.MEMBER_LIST;
    }

    async renameThread({ value: name }) {
        const newName = name.trim();
        if (
            newName !== this.thread.displayName &&
            ((newName && this.thread.type === "channel") ||
                this.thread.type === "chat" ||
                this.thread.type === "group")
        ) {
            await this.services["mail.thread"].notifyThreadNameToServer(this.thread, newName);
        }
    }

    async updateThreadDescription({ value: description }) {
        const newDescription = description.trim();
        if (!newDescription && !this.thread.description) {
            return;
        }
        if (newDescription !== this.thread.description) {
            await this.services["mail.thread"].notifyThreadDescriptionToServer(
                this.thread,
                newDescription
            );
        }
    }

    async renameGuest({ value: name }) {
        const newName = name.trim();
        if (this.services["mail.store"].guest?.name !== newName) {
            await this.services["mail.persona"].updateGuestName(
                this.services["mail.store"].self,
                newName
            );
        }
    }
}
