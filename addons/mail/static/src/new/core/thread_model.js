/* @odoo-module */

import { Composer } from "./composer_model";
import { Partner } from "./partner_model";
import { Guest } from "./guest_model";
import { _t } from "@web/core/l10n/translation";
import { sprintf } from "@web/core/utils/strings";
import { removeFromArray } from "../utils/arrays";
import { cleanTerm } from "@mail/new/utils/format";

import { RtcSession } from "@mail/new/rtc/rtc_session_model";
import { ScrollPosition } from "@mail/new/core/scroll_position_model";
import { createLocalId } from "./thread_model.create_local_id";

export class Thread {
    /** @type {number} */
    id;
    /** @type {string} */
    uuid;
    /** @type {string} */
    model;
    canLeave = false;
    /** @type {import("@mail/new/core/channel_member_model").channelMember[]} */
    channelMembers = [];
    /** @type {import("@mail/new/rtc/rtc_session_model").rtcSession{}} */
    rtcSessions = {};
    /** @type {import("@mail/new/core/partner_model").partner[]} */
    invitedPartners = [];
    /** @type {integer} */
    chatPartnerId;
    /** @type {Composer} */
    composer;
    counter = 0;
    /** @type {string} */
    customName;
    /** @type {string} */
    description;
    /** @type {import("@mail/new/core/follower_model").Follower[]} */
    followers = [];
    isAdmin = false;
    isUnread = false;
    loadMore = true;
    memberCount = 0;
    message_needaction_counter = 0;
    message_unread_counter = 0;
    /** @type {import("@mail/new/core/message_model").Message[]} */
    messages = [];
    /** @type {number} */
    serverLastSeenMsgByCurrentUser;
    /** @type {'opened' | 'folded' | 'closed'} */
    state;
    status = "new";
    /** @type {ScrollPosition} */
    scrollPosition = new ScrollPosition();
    typingMemberIds = [];
    /** @type {import("@mail/new/core/store_service").Store} */
    _store;
    /** @type {string} */
    defaultDisplayMode;

    /**
     * @param {import("@mail/new/core/store_service").Store} store
     * @param {Object} data
     * @returns {Thread}
     */
    static insert(store, data) {
        if (!("id" in data)) {
            throw new Error("Cannot insert thread: id is missing in data");
        }
        if (!("model" in data)) {
            throw new Error("Cannot insert thread: model is missing in data");
        }
        const localId = createLocalId(data.model, data.id);
        if (localId in store.threads) {
            const thread = store.threads[localId];
            thread.update(data);
            return thread;
        }
        const thread = new Thread(store, data);
        // return reactive version
        return store.threads[thread.localId];
    }

    constructor(store, data) {
        Object.assign(this, {
            id: data.id,
            model: data.model,
            type: data.type,
            _store: store,
        });
        if (this.type === "channel") {
            this._store.discuss.channels.threads.push(this.localId);
        } else if (this.type === "chat" || this.type === "group") {
            this._store.discuss.chats.threads.push(this.localId);
        }
        this.update(data);
        store.threads[this.localId] = this;
    }

    update(data) {
        for (const key in data) {
            this[key] = data[key];
        }
        if (data.serverData) {
            const { serverData } = data;
            if ("uuid" in serverData) {
                this.uuid = serverData.uuid;
            }
            if ("authorizedGroupFullName" in serverData) {
                this.authorizedGroupFullName = serverData.authorizedGroupFullName;
            }
            if ("hasWriteAccess" in serverData) {
                this.hasWriteAccess = serverData.hasWriteAccess;
            }
            if ("is_pinned" in serverData) {
                this.is_pinned = serverData.is_pinned;
            }
            if ("message_needaction_counter" in serverData) {
                this.message_needaction_counter = serverData.message_needaction_counter;
            }
            if ("message_unread_counter" in serverData) {
                this.message_unread_counter = serverData.message_unread_counter;
            }
            if ("seen_message_id" in serverData) {
                this.serverLastSeenMsgByCurrentUser = serverData.seen_message_id;
            }
            if ("state" in serverData) {
                this.state = serverData.state;
            }
            if ("defaultDisplayMode" in serverData) {
                this.defaultDisplayMode = serverData.defaultDisplayMode;
            }
            if (this.type === "chat") {
                for (const elem of serverData.channel.channelMembers[0][1]) {
                    Partner.insert(this._store, elem.persona.partner);
                    if (
                        elem.persona.partner.id !== this._store.user.partnerId ||
                        (serverData.channel.channelMembers[0][1].length === 1 &&
                            elem.persona.partner.id === this._store.user.partnerId)
                    ) {
                        this.chatPartnerId = elem.persona.partner.id;
                    }
                }
                this.customName = serverData.channel.custom_channel_name;
            }
            if (this.type === "group") {
                serverData.channel.channelMembers[0][1].forEach((elem) => {
                    if (elem.persona?.partner) {
                        Partner.insert(this._store, elem.persona.partner);
                    }
                    if (elem.persona?.guest) {
                        Guest.insert(this._store, elem.persona.guest);
                    }
                });
            }
            if ("rtcSessions" in serverData) {
                const sessionsData = serverData.rtcSessions[0][1];
                const command = serverData.rtcSessions[0][0];
                switch (command) {
                    case "insert-and-unlink":
                        for (const rtcSessionData of sessionsData) {
                            RtcSession.delete(this._store, rtcSessionData.id);
                        }
                        break;
                    case "insert":
                        for (const rtcSessionData of sessionsData) {
                            const session = RtcSession.insert(this._store, rtcSessionData);
                            this.rtcSessions[session.id] = session;
                        }
                        break;
                }
            }
            if ("invitedPartners" in serverData) {
                this.invitedPartners =
                    serverData.invitedPartners &&
                    serverData.invitedPartners.map((partner) =>
                        Partner.insert(this._store, partner)
                    );
            }
            this.canLeave =
                ["channel", "group"].includes(this.type) &&
                !this.message_needaction_counter &&
                !this.serverData.group_based_subscription;
        }
        Composer.insert(this._store, { thread: this });
    }

    /**
     * Remove a thread form the store
     */
    remove() {
        removeFromArray(this._store.discuss.chats.threads, this.localId);
        removeFromArray(this._store.discuss.channels.threads, this.localId);
        delete this._store.threads[this.localId];
    }

    /**
     * @param {import("@mail/new/core/store_service").Store} store
     */
    static searchSuggestions(store, cleanedSearchTerm, thread, sort) {
        let threads;
        if (
            thread &&
            (thread.type === "group" ||
                thread.type === "chat" ||
                (thread.type === "channel" && thread.authorizedGroupFullName))
        ) {
            // Only return the current channel when in the context of a
            // group restricted channel or group or chat. Indeed, the message with the mention
            // would appear in the target channel, so this prevents from
            // inadvertently leaking the private message into the mentioned
            // channel.
            threads = [thread];
        } else {
            threads = Object.values(store.threads);
        }
        const suggestionList = threads.filter(
            (thread) =>
                thread.type === "channel" &&
                thread.displayName &&
                cleanTerm(thread.displayName).includes(cleanedSearchTerm)
        );
        const sortFunc = (a, b) => {
            const isAPublicChannel = a.type === "channel" && !a.authorizedGroupFullName;
            const isBPublicChannel = b.type === "channel" && !b.authorizedGroupFullName;
            if (isAPublicChannel && !isBPublicChannel) {
                return -1;
            }
            if (!isAPublicChannel && isBPublicChannel) {
                return 1;
            }
            const isMemberOfA = a.hasCurrentUserAsMember;
            const isMemberOfB = b.hasCurrentUserAsMember;
            if (isMemberOfA && !isMemberOfB) {
                return -1;
            }
            if (!isMemberOfA && isMemberOfB) {
                return 1;
            }
            const cleanedADisplayName = cleanTerm(a.displayName || "");
            const cleanedBDisplayName = cleanTerm(b.displayName || "");
            if (
                cleanedADisplayName.startsWith(cleanedSearchTerm) &&
                !cleanedBDisplayName.startsWith(cleanedSearchTerm)
            ) {
                return -1;
            }
            if (
                !cleanedADisplayName.startsWith(cleanedSearchTerm) &&
                cleanedBDisplayName.startsWith(cleanedSearchTerm)
            ) {
                return 1;
            }
            if (cleanedADisplayName < cleanedBDisplayName) {
                return -1;
            }
            if (cleanedADisplayName > cleanedBDisplayName) {
                return 1;
            }
            return a.id - b.id;
        };
        return [
            {
                type: "Thread",
                suggestions: sort ? suggestionList.sort(sortFunc) : suggestionList,
            },
        ];
    }

    sortMessages() {
        this.messages.sort((msgId1, msgId2) => {
            const indicator =
                new Date(this._store.messages[msgId1].dateTime) -
                new Date(this._store.messages[msgId2].dateTime);
            if (indicator) {
                return indicator;
            } else {
                return msgId1 - msgId2;
            }
        });
    }

    get accessRestrictedToGroupText() {
        if (!this.authorizedGroupFullName) {
            return false;
        }
        return sprintf(_t('Access restricted to group "%(groupFullName)s"'), {
            groupFullName: this.authorizedGroupFullName,
        });
    }

    get areAllMembersLoaded() {
        return this.memberCount === this.channelMembers.length;
    }

    get displayName() {
        if (this.type === "chat" && this.chatPartnerId) {
            return this.customName || this._store.partners[this.chatPartnerId].name;
        }
        if (this.type === "group" && !this.name) {
            return this.channelMembers.map((channelMember) => channelMember.name).join(_t(", "));
        }
        return this.name;
    }

    /**
     * @returns {import("@mail/new/core/follower_model").Follower}
     */
    get followerOfCurrentUser() {
        return this.followers.find((f) => f.partner.id === this._store.user.partnerId);
    }

    get imgUrl() {
        const avatarCacheKey = this.serverData?.channel?.avatarCacheKey;
        if (this.type === "channel" || this.type === "group") {
            return `/web/image/mail.channel/${this.id}/avatar_128?unique=${avatarCacheKey}`;
        }
        if (this.type === "chat") {
            return `/web/image/res.partner/${this.chatPartnerId}/avatar_128?unique=${avatarCacheKey}`;
        }
        return false;
    }

    get isDescriptionChangeable() {
        return ["channel", "group"].includes(this.type);
    }

    get isRenameable() {
        return ["chat", "channel", "group"].includes(this.type);
    }

    get isTransient() {
        return !this.id;
    }

    get lastEditableMessageOfCurrentUser() {
        const messages = this.messages.map((id) => this._store.messages[id]);
        const editableMessagesOfCurrentUser = messages.filter(
            (message) => message.isAuthoredByCurrentUser && message.canBeEdited
        );
        if (editableMessagesOfCurrentUser.length > 0) {
            return editableMessagesOfCurrentUser.at(-1);
        }
        return null;
    }

    get localId() {
        return createLocalId(this.model, this.id);
    }

    /** @returns {import("@mail/new/core/message_model").Message | undefined} */
    get mostRecentMsg() {
        if (!this.mostRecentMsgId) {
            return undefined;
        }
        return this._store.messages[this.mostRecentMsgId];
    }

    get mostRecentMsgId() {
        if (this.messages.length === 0) {
            return undefined;
        }
        return Math.max(...this.messages);
    }

    get mostRecentNonTransientMessage() {
        if (this.messages.length === 0) {
            return undefined;
        }
        const oldestNonTransientMessageId = [...this.messages]
            .reverse()
            .find((messageId) => Number.isInteger(messageId));
        return this._store.messages[oldestNonTransientMessageId];
    }

    get hasCurrentUserAsMember() {
        return this.channelMembers.some((channelMember) => channelMember.isCurrentUser);
    }

    get invitationLink() {
        if (!this.uuid || this.type === "chat") {
            return undefined;
        }
        return `${window.location.origin}/chat/${this.id}/${this.uuid}`;
    }

    get isEmpty() {
        return this.messages.length === 0;
    }

    get offlineMembers() {
        const orderedOnlineMembers = [];
        for (const member of this.channelMembers) {
            if (member.im_status !== "online") {
                orderedOnlineMembers.push(member);
            }
        }
        return orderedOnlineMembers.sort((p1, p2) => (p1.name < p2.name ? -1 : 1));
    }

    get oldestNonTransientMessage() {
        if (this.messages.length === 0) {
            return undefined;
        }
        const oldestNonTransientMessageId = this.messages.find((messageId) =>
            Number.isInteger(messageId)
        );
        return this._store.messages[oldestNonTransientMessageId];
    }

    get onlineMembers() {
        const orderedOnlineMembers = [];
        for (const member of this.channelMembers) {
            if (member.im_status === "online") {
                orderedOnlineMembers.push(member);
            }
        }
        return orderedOnlineMembers.sort((p1, p2) => (p1.name < p2.name ? -1 : 1));
    }

    get unknownMembersCount() {
        return this.memberCount - this.channelMembers.length;
    }

    get hasTypingMembers() {
        return this.typingMembers.length !== 0;
    }

    get typingMembers() {
        return this.typingMemberIds.map((memberId) => this._store.channelMembers[memberId]);
    }
}
