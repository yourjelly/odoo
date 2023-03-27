/* @odoo-module */

import { markup, reactive } from "@odoo/owl";
import { Deferred } from "@web/core/utils/concurrency";
import { memoize } from "@web/core/utils/functions";
import { cleanTerm } from "@mail/utils/format";
import { removeFromArray, removeFromArrayWithPredicate } from "@mail/utils/arrays";
import { LinkPreview } from "./link_preview_model";
import { CannedResponse } from "./canned_response_model";
import { browser } from "@web/core/browser/browser";
import { sprintf } from "@web/core/utils/strings";
import { _t } from "@web/core/l10n/translation";
import { createLocalId } from "../utils/misc";
import { registry } from "@web/core/registry";

export const OTHER_LONG_TYPING = 60000;

/**
 * @typedef {Messaging} Messaging
 */
export class Messaging {
    constructor(...args) {
        this.setup(...args);
    }

    setup(env, services) {
        this.env = env;
        this.rpc = services.rpc;
        this.orm = services.orm;
        this.services = {
            /** @type {import("@mail/core/store_service").Store} */
            "mail.store": services["mail.store"],
            /** @type {import("@mail/core/channel_member_service").ChannelMemberService} */
            "mail.channel.member": services["mail.channel.member"],
            /** @type {import("@mail/attachments/attachment_service").AttachmentService} */
            "mail.attachment": services["mail.attachment"],
            /** @type {import("@mail/core/sound_effects_service").SoundEffects} */
            "mail.sound_effects": services["mail.sound_effects"],
            /** @type {import("@mail/core/user_settings_service").UserSettings} */
            "mail.user_settings": services["mail.user_settings"],
            /** @type {import("@mail/core/thread_service").ThreadService} */
            "mail.thread": services["mail.thread"],
            /** @type {import("@mail/core/thread_message_fetch_service").ThreadMessageFetchService} */
            "mail.thread.message_fetch": services["mail.thread.message_fetch"],
            /** @type {import("@mail/core/message_service").MessageService} */
            "mail.message": services["mail.message"],
            /** @type {import("@mail/core/message_star_service").MessageStarService} */
            "mail.message.star": services["mail.message.star"],
            /** @type {import("@mail/core/persona_service").PersonaService} */
            "mail.persona": services["mail.persona"],
            /** @type {import("@mail/core/out_of_focus_service").OutOfFocusService} */
            "mail.out_of_focus": services["mail.out_of_focus"],
            /** @type {import("@mail/rtc/rtc_service").Rtc} */
            "mail.rtc": services["mail.rtc"],
        };
        this.notificationService = services.notification;
        this.router = services.router;
        this.bus = services.bus_service;
        this.presence = services.presence;
        this.isReady = new Deferred();
        this.imStatusService = services.im_status;
        const user = services.user;
        this.services["mail.persona"].insert({
            id: user.partnerId,
            type: "partner",
            isAdmin: user.isAdmin,
        });
        this.registeredImStatusPartners = reactive([], () => this.updateImStatusRegistration());
        this.services["mail.store"].registeredImStatusPartners = this.registeredImStatusPartners;
        this.services["mail.store"].discuss.inbox = this.services["mail.thread"].insert({
            id: "inbox",
            model: "mail.box",
            name: _t("Inbox"),
            type: "mailbox",
        });
        this.services["mail.store"].discuss.starred = this.services["mail.thread"].insert({
            id: "starred",
            model: "mail.box",
            name: _t("Starred"),
            type: "mailbox",
            counter: 0,
        });
        this.services["mail.store"].discuss.history = this.services["mail.thread"].insert({
            id: "history",
            model: "mail.box",
            name: _t("History"),
            type: "mailbox",
            counter: 0,
        });
        this.updateImStatusRegistration();
    }

    /**
     * Import data received from init_messaging
     */
    initialize() {
        this.rpc("/mail/init_messaging", {}, { silent: true }).then(
            this.initMessagingCallback.bind(this)
        );
    }

    initMessagingCallback(data) {
        if (data.current_partner) {
            this.services["mail.store"].user = this.services["mail.persona"].insert({
                ...data.current_partner,
                type: "partner",
            });
        }
        if (data.currentGuest) {
            this.services["mail.store"].guest = this.services["mail.persona"].insert({
                ...data.currentGuest,
                type: "guest",
                channelId: data.channels[0]?.id,
            });
        }
        this.services["mail.store"].partnerRoot = this.services["mail.persona"].insert({
            ...data.partner_root,
            type: "partner",
        });
        for (const channelData of data.channels) {
            this.services["mail.thread"].createChannelThread(channelData);
        }
        this.services["mail.thread"].sortChannels();
        const settings = data.current_user_settings;
        this.services["mail.user_settings"].updateFromCommands(settings);
        this.services["mail.user_settings"].id = settings.id;
        this.services["mail.store"].companyName = data.companyName;
        this.services["mail.store"].discuss.channels.isOpen =
            settings.is_discuss_sidebar_category_channel_open;
        this.services["mail.store"].discuss.chats.isOpen =
            settings.is_discuss_sidebar_category_chat_open;
        this.services["mail.store"].discuss.inbox.counter = data.needaction_inbox_counter;
        this.services["mail.store"].internalUserGroupId = data.internalUserGroupId;
        this.services["mail.store"].discuss.starred.counter = data.starred_counter;
        this.services["mail.store"].discuss.isActive =
            data.menu_id === this.router.current.hash?.menu_id ||
            this.router.hash?.action === "mail.action_discuss";
        (data.shortcodes ?? []).forEach((code) => {
            this.insertCannedResponse(code);
        });
        this.isReady.resolve();
        this.services["mail.store"].isMessagingReady = true;
    }

    loadFailures() {
        this.rpc("/mail/load_message_failures", {}, { silent: true }).then((messages) => {
            messages.map((messageData) =>
                this.services["mail.message"].insert({
                    ...messageData,
                    body: messageData.body ? markup(messageData.body) : messageData.body,
                    // implicit: failures are sent by the server at
                    // initialization only if the current partner is
                    // author of the message
                    author: this.services["mail.store"].user,
                })
            );
            this.services["mail.store"].notificationGroups.sort(
                (n1, n2) => n2.lastMessage.id - n1.lastMessage.id
            );
        });
    }

    updateImStatusRegistration() {
        this.imStatusService.registerToImStatus(
            "res.partner",
            /**
             * Read value from registeredImStatusPartners own reactive rather than
             * from store reactive to ensure the callback keeps being registered.
             */
            [...this.registeredImStatusPartners]
        );
    }

    // -------------------------------------------------------------------------
    // process notifications received by the bus
    // -------------------------------------------------------------------------

    handleNotification(notifications) {
        const channelsLeft = new Set(
            notifications.reduce((channelIds, notification) => {
                if (notification.type === "mail.channel/leave") {
                    channelIds.push(notification.payload.id);
                }
                return channelIds;
            }, [])
        );
        for (const notif of notifications) {
            this.env.bus.trigger("mail.messaging/notification", { notification: notif });
            switch (notif.type) {
                case "mail.channel/new_message":
                    if (channelsLeft.has(notif.payload.id)) {
                        // Do not handle new message notification if the channel
                        // was just left. This issue occurs because the
                        // "mail.channel/leave" and the
                        // "mail.channel/new_message" notifications come from
                        // the bus as a batch.
                        return;
                    }
                    this._handleNotificationNewMessage(notif);
                    break;
                case "mail.channel/leave":
                    {
                        const thread = this.services["mail.thread"].insert({
                            ...notif.payload,
                            model: "mail.channel",
                        });
                        this.services["mail.thread"].remove(thread);
                        if (thread.localId === this.services["mail.store"].discuss.threadLocalId) {
                            this.services["mail.store"].discuss.threadLocalId = undefined;
                        }
                        this.notificationService.add(
                            sprintf(_t("You unsubscribed from %s."), thread.displayName),
                            { type: "info" }
                        );
                    }
                    break;
                case "mail.channel/rtc_sessions_update":
                    {
                        const { id, rtcSessions } = notif.payload;
                        const sessionsData = rtcSessions[0][1];
                        const command = rtcSessions[0][0];
                        this._updateRtcSessions(id, sessionsData, command);
                    }
                    break;
                case "mail.record/insert":
                    this._handleNotificationRecordInsert(notif);
                    break;
                case "mail.channel/joined": {
                    const { channel, invited_by_user_id: invitedByUserId } = notif.payload;
                    const thread = this.services["mail.thread"].insert({
                        ...channel,
                        model: "mail.channel",
                        rtcSessions: undefined,
                        serverData: {
                            channel: channel.channel,
                        },
                        type: channel.channel.channel_type,
                    });
                    const rtcSessions = channel.rtcSessions;
                    const sessionsData = rtcSessions[0][1];
                    const command = rtcSessions[0][0];
                    this._updateRtcSessions(thread.id, sessionsData, command);

                    if (invitedByUserId !== this.services["mail.store"].user?.user.id) {
                        this.notificationService.add(
                            sprintf(_t("You have been invited to #%s"), thread.displayName),
                            { type: "info" }
                        );
                    }
                    break;
                }
                case "mail.channel/legacy_insert":
                    this.services["mail.thread"].insert({
                        id: notif.payload.channel.id,
                        model: "mail.channel",
                        serverData: notif.payload,
                        type: notif.payload.channel.channel_type,
                    });
                    break;
                case "mail.channel/transient_message":
                    return this.services["mail.message"].createTransient(
                        Object.assign(notif.payload, { body: markup(notif.payload.body) })
                    );
                case "mail.link.preview/delete":
                    {
                        const { id, message_id } = notif.payload;
                        const index = this.services["mail.store"].messages[
                            message_id
                        ].linkPreviews.findIndex((linkPreview) => linkPreview.id === id);
                        delete this.services["mail.store"].messages[message_id].linkPreviews[index];
                    }
                    break;
                case "mail.message/inbox": {
                    const data = Object.assign(notif.payload, { body: markup(notif.payload.body) });
                    this.services["mail.message"].insert(data);
                    break;
                }
                case "mail.message/mark_as_read": {
                    const { message_ids: messageIds, needaction_inbox_counter } = notif.payload;
                    for (const messageId of messageIds) {
                        // We need to ignore all not yet known messages because we don't want them
                        // to be shown partially as they would be linked directly to cache.
                        // Furthermore, server should not send back all messageIds marked as read
                        // but something like last read messageId or something like that.
                        // (just imagine you mark 1000 messages as read ... )
                        const message = this.services["mail.store"].messages[messageId];
                        if (!message) {
                            continue;
                        }
                        // update thread counter (before removing message from Inbox, to ensure isNeedaction check is correct)
                        const originThread = message.originThread;
                        if (originThread && message.isNeedaction) {
                            originThread.message_needaction_counter--;
                        }
                        // move messages from Inbox to history
                        const partnerIndex = message.needaction_partner_ids.find(
                            (p) => p === this.services["mail.store"].user.id
                        );
                        removeFromArray(message.needaction_partner_ids, partnerIndex);
                        removeFromArrayWithPredicate(
                            this.services["mail.store"].discuss.inbox.messages,
                            ({ id }) => id === messageId
                        );
                        if (this.services["mail.store"].discuss.history.messages.length > 0) {
                            this.services["mail.store"].discuss.history.messages.push(message);
                        }
                    }
                    this.services["mail.store"].discuss.inbox.counter = needaction_inbox_counter;
                    if (
                        this.services["mail.store"].discuss.inbox.counter >
                        this.services["mail.store"].discuss.inbox.messages.length
                    ) {
                        this.services["mail.thread.message_fetch"].fetchMessages(
                            this.services["mail.store"].discuss.inbox
                        );
                    }
                    break;
                }
                case "mail.channel.member/seen": {
                    const { channel_id, last_message_id, partner_id } = notif.payload;
                    const channel =
                        this.services["mail.store"].threads[
                            createLocalId("mail.channel", channel_id)
                        ];
                    if (!channel) {
                        // for example seen from another browser, the current one has no
                        // knowledge of the channel
                        continue;
                    }
                    if (this.services["mail.store"].user.id === partner_id) {
                        channel.serverLastSeenMsgBySelf = last_message_id;
                    }
                    const seenInfo = channel.seenInfos.find(
                        (seenInfo) => seenInfo.partner.id === partner_id
                    );
                    if (seenInfo) {
                        seenInfo.lastSeenMessage = { id: last_message_id };
                    }
                    break;
                }

                case "mail.channel.member/fetched": {
                    const { channel_id, last_message_id, partner_id } = notif.payload;
                    const channel =
                        this.services["mail.store"].threads[
                            createLocalId("mail.channel", channel_id)
                        ];
                    if (!channel) {
                        return;
                    }
                    const seenInfo = channel.seenInfos.find(
                        (seenInfo) => seenInfo.partner.id === partner_id
                    );
                    if (seenInfo) {
                        seenInfo.lastFetchedMessage = { id: last_message_id };
                    }
                    break;
                }
                case "mail.channel.member/typing_status": {
                    const isTyping = notif.payload.isTyping;
                    const channel =
                        this.services["mail.store"].threads[
                            createLocalId("mail.channel", notif.payload.channel.id)
                        ];
                    if (!channel) {
                        return;
                    }
                    const member = this.services["mail.channel.member"].insert(notif.payload);
                    if (member.persona === this.services["mail.store"].self) {
                        return;
                    }
                    if (isTyping) {
                        if (!channel.typingMembers.includes(member)) {
                            channel.typingMemberIds.push(member.id);
                        }
                        if (member.typingTimer) {
                            browser.clearTimeout(member.typingTimer);
                        }
                        member.typingTimer = browser.setTimeout(() => {
                            removeFromArray(channel.typingMemberIds, member.id);
                        }, OTHER_LONG_TYPING);
                    } else {
                        removeFromArray(channel.typingMemberIds, member.id);
                    }
                    break;
                }
                case "mail.channel/unpin": {
                    const thread =
                        this.services["mail.store"].threads[
                            createLocalId("mail.channel", notif.payload.id)
                        ];
                    if (!thread) {
                        return;
                    }
                    thread.is_pinned = false;
                    this.notificationService.add(
                        sprintf(_t("You unpinned your conversation with %s"), thread.displayName),
                        { type: "info" }
                    );
                    break;
                }
                case "mail.message/notification_update":
                    {
                        notif.payload.elements.map((message) => {
                            this.services["mail.message"].insert({
                                ...message,
                                body: markup(message.body),
                                // implicit: failures are sent by the server at
                                // initialization only if the current partner is
                                // author of the message
                                author: this.services["mail.store"].self,
                            });
                        });
                    }
                    break;
                case "mail.channel/last_interest_dt_changed":
                    this._handleNotificationLastInterestDtChanged(notif);
                    break;
                default:
                    break;
            }
        }
    }

    _handleNotificationLastInterestDtChanged(notif) {
        const { id, last_interest_dt } = notif.payload;
        const channel = this.services["mail.store"].threads[createLocalId("mail.channel", id)];
        if (channel) {
            this.services["mail.thread"].update(channel, { serverData: { last_interest_dt } });
        }
        if (["chat", "group"].includes(channel?.type)) {
            this.services["mail.thread"].sortChannels();
        }
    }

    async _handleNotificationNewMessage(notif) {
        const { id, message: messageData } = notif.payload;
        let channel = this.services["mail.store"].threads[createLocalId("mail.channel", id)];
        if (!channel) {
            const [channelData] = await this.orm.call("mail.channel", "channel_info", [id]);
            channel = this.services["mail.thread"].insert({
                id: channelData.id,
                model: "mail.channel",
                type: channelData.channel.channel_type,
                serverData: channelData,
            });
        }
        if (!channel.is_pinned) {
            this.services["mail.thread"].pin(channel);
        }

        removeFromArrayWithPredicate(channel.messages, ({ id }) => id === messageData.temporary_id);
        delete this.services["mail.store"].messages[messageData.temporary_id];
        messageData.temporary_id = null;
        if ("parentMessage" in messageData && messageData.parentMessage.body) {
            messageData.parentMessage.body = markup(messageData.parentMessage.body);
        }
        const data = Object.assign(messageData, {
            body: markup(messageData.body),
        });
        const message = this.services["mail.message"].insert({
            ...data,
            res_id: channel.id,
            model: channel.model,
        });
        if (channel.chatPartnerId !== this.services["mail.store"].partnerRoot?.id) {
            if (!this.presence.isOdooFocused() && channel.isChatChannel) {
                this.services["mail.out_of_focus"].notify(message, channel);
            }

            if (channel.type !== "channel" && !this.services["mail.store"].guest) {
                // disabled on non-channel threads and
                // on "channel" channels for performance reasons
                this.services["mail.thread"].markAsFetched(channel);
            }
        }
        if (
            !message.isSelfAuthored &&
            channel.composer.isFocused &&
            channel.mostRecentNonTransientMessage &&
            !this.services["mail.store"].guest &&
            channel.mostRecentNonTransientMessage === channel.mostRecentMsg
        ) {
            this.services["mail.thread"].markAsRead(channel);
        }
    }

    _handleNotificationRecordInsert(notif) {
        if (notif.payload.Thread) {
            this.services["mail.thread"].insert({
                id: notif.payload.Thread.id,
                model: notif.payload.Thread.model,
                serverData: notif.payload.Thread,
            });
        }

        if (notif.payload.Channel) {
            this.services["mail.thread"].insert({
                id: notif.payload.Channel.id,
                model: "mail.channel",
                serverData: {
                    channel: {
                        avatarCacheKey: notif.payload.Channel.avatarCacheKey,
                        ...notif.payload.Channel,
                    },
                },
            });
        }
        if (notif.payload.RtcSession) {
            this.services["mail.rtc"].insertSession(notif.payload.RtcSession);
        }
        if (notif.payload.Partner) {
            const partners = Array.isArray(notif.payload.Partner)
                ? notif.payload.Partner
                : [notif.payload.Partner];
            for (const partner of partners) {
                if (partner.im_status) {
                    this.services["mail.persona"].insert({ ...partner, type: "partner" });
                }
            }
        }
        if (notif.payload.Guest) {
            const guests = Array.isArray(notif.payload.Guest)
                ? notif.payload.Guest
                : [notif.payload.Guest];
            for (const guest of guests) {
                this.services["mail.persona"].insert({ ...guest, type: "guest" });
            }
        }
        const { LinkPreview: linkPreviews } = notif.payload;
        if (linkPreviews) {
            for (const linkPreview of linkPreviews) {
                this.services["mail.store"].messages[linkPreview.message.id].linkPreviews.push(
                    new LinkPreview(linkPreview)
                );
            }
        }
        const { Message: messageData } = notif.payload;
        if (messageData) {
            const isStarred = this.services["mail.store"].messages[messageData.id]?.isStarred;
            const message = this.services["mail.message"].insert({
                ...messageData,
                body: messageData.body ? markup(messageData.body) : messageData.body,
            });
            if (isStarred && message.isEmpty) {
                this.services["mail.message.star"].updateStarred(message, false);
            }
        }
        const { "res.users.settings": settings } = notif.payload;
        if (settings) {
            this.services["mail.user_settings"].updateFromCommands(settings);
            this.services["mail.store"].discuss.chats.isOpen =
                settings.is_discuss_sidebar_category_chat_open ??
                this.services["mail.store"].discuss.chats.isOpen;
            this.services["mail.store"].discuss.channels.isOpen =
                settings.is_discuss_sidebar_category_channel_open ??
                this.services["mail.store"].discuss.channels.isOpen;
        }
        const { "res.users.settings.volumes": volumeSettings } = notif.payload;
        if (volumeSettings) {
            this.services["mail.user_settings"].setVolumes(volumeSettings);
        }
    }

    _updateRtcSessions(channelId, sessionsData, command) {
        const channel =
            this.services["mail.store"].threads[createLocalId("mail.channel", channelId)];
        if (!channel) {
            return;
        }
        const oldCount = Object.keys(channel.rtcSessions).length;
        switch (command) {
            case "insert-and-unlink":
                for (const sessionData of sessionsData) {
                    this.services["mail.rtc"].deleteSession(sessionData.id);
                }
                break;
            case "insert":
                for (const sessionData of sessionsData) {
                    const session = this.services["mail.rtc"].insertSession(sessionData);
                    channel.rtcSessions[session.id] = session;
                }
                break;
        }
        if (Object.keys(channel.rtcSessions).length > oldCount) {
            this.services["mail.sound_effects"].play("channel-join");
        } else if (Object.keys(channel.rtcSessions).length < oldCount) {
            this.services["mail.sound_effects"].play("member-leave");
        }
    }

    // -------------------------------------------------------------------------
    // actions that can be performed on the messaging system
    // -------------------------------------------------------------------------

    fetchPreviews = memoize(async () => {
        const ids = [];
        for (const thread of Object.values(this.services["mail.store"].threads)) {
            if (["channel", "group", "chat"].includes(thread.type)) {
                ids.push(thread.id);
            }
        }
        if (ids.length) {
            const previews = await this.orm.call("mail.channel", "channel_fetch_preview", [ids]);
            for (const preview of previews) {
                const thread =
                    this.services["mail.store"].threads[createLocalId("mail.channel", preview.id)];
                const data = Object.assign(preview.last_message, {
                    body: markup(preview.last_message.body),
                });
                this.services["mail.message"].insert({
                    ...data,
                    res_id: thread.id,
                    model: thread.model,
                });
            }
        }
    });

    async searchPartners(searchStr = "", limit = 10) {
        let partners = [];
        const searchTerm = cleanTerm(searchStr);
        for (const localId in this.services["mail.store"].personas) {
            const persona = this.services["mail.store"].personas[localId];
            if (persona.type !== "partner") {
                continue;
            }
            const partner = persona;
            // todo: need to filter out non-user partners (there was a user key)
            // also, filter out inactive partners
            if (partner.name && cleanTerm(partner.name).includes(searchTerm)) {
                partners.push(partner);
                if (partners.length >= limit) {
                    break;
                }
            }
        }
        if (!partners.length) {
            const partnersData = await this.orm.silent.call("res.partner", "im_search", [
                searchTerm,
                limit,
            ]);
            partners = partnersData.map((data) =>
                this.services["mail.persona"].insert({ ...data, type: "partner" })
            );
        }
        return partners;
    }

    openDocument({ id, model }) {
        this.env.services.action.doAction({
            type: "ir.actions.act_window",
            res_model: model,
            views: [[false, "form"]],
            res_id: id,
        });
    }

    insertCannedResponse(data) {
        let cannedResponse = this.services["mail.store"].cannedResponses[data.id];
        if (!cannedResponse) {
            this.services["mail.store"].cannedResponses[data.id] = new CannedResponse();
            cannedResponse = this.services["mail.store"].cannedResponses[data.id];
        }
        Object.assign(cannedResponse, {
            id: data.id,
            name: data.source,
            substitution: data.substitution,
        });
        return cannedResponse;
    }
}

export const messagingService = {
    dependencies: [
        "mail.store",
        "mail.channel.member",
        "rpc",
        "orm",
        "user",
        "router",
        "bus_service",
        "im_status",
        "notification",
        "presence",
        "mail.attachment",
        "mail.sound_effects",
        "mail.user_settings",
        "mail.thread",
        "mail.thread.message_fetch",
        "mail.message",
        "mail.message.star",
        "mail.persona",
        "mail.rtc",
        "mail.out_of_focus",
    ],
    start(env, services) {
        // compute initial discuss thread if not on public page
        if (!services["mail.store"].inPublicPage) {
            let threadLocalId = createLocalId("mail.box", "inbox");
            const activeId = services.router.current.hash.active_id;
            if (typeof activeId === "number") {
                threadLocalId = createLocalId("mail.channel", activeId);
            }
            if (typeof activeId === "string" && activeId.startsWith("mail.box_")) {
                threadLocalId = createLocalId("mail.box", activeId.slice(9));
            }
            if (typeof activeId === "string" && activeId.startsWith("mail.channel_")) {
                threadLocalId = createLocalId("mail.channel", parseInt(activeId.slice(13), 10));
            }
            services["mail.store"].discuss.threadLocalId = threadLocalId;
        }
        const messaging = new Messaging(env, services);
        messaging.initialize();
        services.bus_service.addEventListener("notification", (notifEvent) => {
            messaging.handleNotification(notifEvent.detail);
        });
        services.bus_service.start();
        return messaging;
    },
};

registry.category("services").add("mail.messaging", messagingService);
