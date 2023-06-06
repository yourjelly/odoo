/* @odoo-module */

import { ImStatus } from "./im_status";
import { AutoresizeInput } from "./autoresize_input";
import { useThreadActions } from "@mail/core/thread_actions";
import { Thread } from "../core_ui/thread";
import { ThreadIcon } from "./thread_icon";
import { useMessaging, useStore } from "../core/messaging_hook";
import { useRtc } from "../rtc/rtc_hook";
import { useMessageEdition, useMessageHighlight, useMessageToReplyTo } from "@mail/utils/hooks";
import { Composer } from "../composer/composer";
import { Call } from "../rtc/call";
import { FileUploader } from "@web/views/fields/file_handler";
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
import { useService } from "@web/core/utils/hooks";
import { _t } from "@web/core/l10n/translation";
import { url } from "@web/core/utils/urls";

export class Discuss extends Component {
    static components = {
        AutoresizeInput,
        Thread,
        ThreadIcon,
        Composer,
        Call,
        FileUploader,
        ImStatus,
    };
    static props = {};
    static template = "mail.Discuss";

    setup() {
        this.messaging = useMessaging();
        this.store = useStore();
        this.threadService = useState(useService("mail.thread"));
        this.messageService = useState(useService("mail.message"));
        this.personaService = useService("mail.persona");
        this.rtc = useRtc();
        this.router = useService("router");
        this.messageHighlight = useMessageHighlight();
        this.messageEdition = useMessageEdition();
        this.messageToReplyTo = useMessageToReplyTo();
        this.contentRef = useRef("content");
        this.root = useRef("root");
        this.orm = useService("orm");
        this.effect = useService("effect");
        this.ui = useState(useService("ui"));
        this.prevInboxCounter = this.store.discuss.inbox.counter;
        useChildSubEnv({
            inDiscussApp: true,
            messageHighlight: this.messageHighlight,
        });
        this.notification = useService("notification");
        this.threadActions = useThreadActions();
        useEffect(
            () => {
                if (
                    this.thread?.id === "inbox" &&
                    this.prevInboxCounter !== this.store.discuss.inbox.counter &&
                    this.store.discuss.inbox.counter === 0
                ) {
                    this.effect.add({
                        message: _t("Congratulations, your inbox is empty!"),
                        type: "rainbow_man",
                        fadeout: "fast",
                    });
                }
                this.prevInboxCounter = this.store.discuss.inbox.counter;
            },
            () => [this.store.discuss.inbox.counter]
        );
        onWillStart(() => this.messaging.isReady);
        onMounted(() => {
            this.store.discuss.isActive = true;
            // The action service removes the active_id after loading
            // the page, so we need to set it again.
            if (this.thread) {
                const activeId =
                    typeof this.thread.id === "string"
                        ? `mail.box_${this.thread.id}`
                        : `discuss.channel_${this.thread.id}`;
                this.router.pushState({ active_id: activeId });
            }
        });
        onWillUnmount(() => (this.store.discuss.isActive = false));
    }

    get thread() {
        return this.store.threads[this.store.discuss.threadLocalId];
    }

    get channelAvatar() {
        return this.store.inPublicPage
            ? url(
                  `/discuss/channel/${this.thread.id}/avatar_128?unique=${this.thread?.avatarCacheKey}`
              )
            : this.thread.imgUrl;
    }

    async onFileUploaded(file) {
        await this.threadService.notifyThreadAvatarToServer(this.thread.id, file.data);
        this.notification.add(_t("The avatar has been updated!"), { type: "success" });
    }

    async renameThread({ value: name }) {
        const newName = name.trim();
        if (
            newName !== this.thread.displayName &&
            ((newName && this.thread.type === "channel") ||
                this.thread.type === "chat" ||
                this.thread.type === "group")
        ) {
            await this.threadService.notifyThreadNameToServer(this.thread, newName);
        }
    }

    async updateThreadDescription({ value: description }) {
        const newDescription = description.trim();
        if (!newDescription && !this.thread.description) {
            return;
        }
        if (newDescription !== this.thread.description) {
            await this.threadService.notifyThreadDescriptionToServer(this.thread, newDescription);
        }
    }

    async renameGuest({ value: name }) {
        const newName = name.trim();
        if (this.store.guest?.name !== newName) {
            await this.personaService.updateGuestName(this.store.self, newName);
        }
    }
}
