odoo.define('mail.store.getters', function () {
"use strict";

const getters = {

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @param {Object} param0
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {integer} param1.resId
     * @param {string} param1.resModel
     * @return {mail.store.model.Attachment[]}
     */
    attachments({ state }, { resId, resModel }) {
        return Object
            .values(state.attachments)
            .filter(attachment => attachment.res_id === resId && attachment.res_model === resModel)
            .sort((att1, att2) => att1.id < att2.id ? -1 : 1);
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.getters
     * @return {mail.store.model.Thread[]} ordered list of channels
     */
    channelList({ getters }) {
        const channels = getters.channels();
        return Object
            .values(channels)
            .sort((channel1, channel2) => {
                const channel1Name = getters.threadName(channel1.localId);
                const channel2Name = getters.threadName(channel2.localId);
                channel1Name < channel2Name ? -1 : 1;
            });
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.state
     * @return {Object} filtered threads that are channels
     */
    channels({ state }) {
        const filteredEntries = Object
            .entries(state.threads)
            .filter(([threadLocalId, thread]) =>
                thread.channel_type === 'channel');
        return Object.fromEntries(filteredEntries);
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.getters
     * @param {string} partnerLocalId
     * @return {mail.store.model.Thread|undefined}
     */
    chatFromPartner({ getters }, partnerLocalId) {
        return getters.chatList().find(chat => chat.directPartnerLocalId === partnerLocalId);
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.getters
     * @return {mail.store.model.Thread[]} ordered list of chats
     */
    chatList({ getters }) {
        const chats = getters.chats();
        return Object
            .values(chats)
            .sort((chat1, chat2) => {
                const chat1Name = getters.threadName(chat1.localId);
                const chat2Name = getters.threadName(chat2.localId);
                chat1Name < chat2Name ? -1 : 1;
            });
    },
    /**
     * @private
     * @param {Object} param0
     * @param {Object} param0.state
     * @return {Object} filtered threads that are chats
     */
    chats({ state }) {
        const filteredEntries = Object
            .entries(state.threads)
            .filter(([threadLocalId, thread]) =>
                thread.channel_type === 'chat');
        return Object.fromEntries(filteredEntries);
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.getters
     * @return {integer}
     */
    globalThreadUnreadCounter({ getters, state }) {
        const unreadMailChannelCounter = getters.mailChannelList()
            .reduce((acc, mailChannel) => {
                if (mailChannel.message_unread_counter > 0) {
                    acc++;
                }
                return acc;
            }, 0);
        const mailboxInboxCounter = state.threads['mail.box_inbox'].counter;
        return unreadMailChannelCounter + mailboxInboxCounter;
    },
    /**
     * @param {Object} param0
     * @param {Object} param1
     * @return {mail.store.model.Attachment[]} image attachments of the record
     */
    imageAttachments({ getters }, { resId, resModel }) {
        return getters
            .attachments({ resId, resModel })
            .filter(att => att.mediaType === 'image');
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.getters
     * @return {mail.store.model.Thread[]} ordered list of mailboxes
     */
    mailboxList({ getters }) {
        const mailboxes = getters.mailboxes();
        return Object
            .values(mailboxes)
            .sort((mailbox1, mailbox2) => {
                if (mailbox1.localId === 'mail.box_inbox') {
                    return -1;
                }
                if (mailbox2.localId === 'mail.box_inbox') {
                    return 1;
                }
                if (mailbox1.localId === 'mail.box_starred') {
                    return -1;
                }
                if (mailbox2.localId === 'mail.box_starred') {
                    return 1;
                }
                const mailbox1Name = getters.threadName(mailbox1.localId);
                const mailbox2Name = getters.threadName(mailbox2.localId);
                mailbox1Name < mailbox2Name ? -1 : 1;
            });
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.state
     * @return {Object} filtered threads that are mailboxes
     */
    mailboxes({ state }) {
        const filteredEntries = Object
            .entries(state.threads)
            .filter(([threadLocalId, thread]) =>
                thread._model === 'mail.box');
        return Object.fromEntries(filteredEntries);
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.state
     * @return {mail.store.model.Thread[]} filtered threads that are mail.channels
     */
    mailChannelList({ getters }) {
        const mailChannels = getters.mailChannels();
        return Object
            .values(mailChannels)
            .sort((mailChannel1, mailChannel2) => {
                const mailChannel1Name = getters.threadName(mailChannel1.localId);
                const mailChannel2Name = getters.threadName(mailChannel2.localId);
                mailChannel1Name < mailChannel2Name ? -1 : 1;
            });
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.state
     * @return {Object} filtered threads that are mail.channels
     */
    mailChannels({ state }) {
        const filteredEntries = Object
            .entries(state.threads)
            .filter(([threadLocalId, thread]) =>
                thread._model === 'mail.channel');
        return Object.fromEntries(filteredEntries);
    },
    /**
     * @param {Object} param0
     * @param {Object} param1
     * @return {mail.store.model.Attachment[]} non-image attachments of the record
     */
    nonImageAttachments({ getters }, { resId, resModel }) {
        return getters
            .attachments({ resId, resModel })
            .filter(att => att.mediaType !== 'image');
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.getters
     * @return {mail.store.model.Thread[]} ordered list of pinned channels
     */
    pinnedChannelList({ getters }) {
        return getters.channelList().filter(channel => channel.isPinned);
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.getters
     * @return {Object} filtered channels that are pinned
     */
    pinnedChannels({ getters }) {
        const channels = getters.channels();
        const filteredEntries = Object
            .entries(channels)
            .filter(([channelLocalId, channel]) => channel.isPinned);
        return Object.fromEntries(filteredEntries);
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.getters
     * @return {mail.store.model.Thread[]} ordered list of pinned chats
     */
    pinnedChatList({ getters }) {
        return getters.chatList().filter(chat => chat.isPinned);
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.getters
     * @return {Object} filtered chats that are pinned
     */
    pinnedChats({ getters }) {
        const chats = getters.chats();
        const filteredEntries = Object
            .entries(chats)
            .filter(([chatLocalId, chat]) => chat.isPinned);
        return Object.fromEntries(filteredEntries);
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.getters
     * @return {mail.store.model.Thread[]} ordered list of pinned mailboxes
     */
    pinnedMailboxList({ getters }) {
        return getters.mailboxList().filter(mailbox => mailbox.isPinned);
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.getters
     * @return {Object} filtered mailboxes that are pinned
     */
    pinnedMailboxes({ getters }) {
        const mailboxes = getters.mailboxes();
        const filteredEntries = Object
            .entries(mailboxes)
            .filter(([mailboxLocalId, mailbox]) => mailbox.isPinned);
        return Object.fromEntries(filteredEntries);
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.state
     * @return {integer}
     */
    pinnedMailChannelAmount({ getters }) {
        const pinnedChannelAmount = getters.pinnedChannelList().length;
        const pinnedChatAmount = getters.pinnedChatList().length;
        return pinnedChannelAmount + pinnedChatAmount;
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.state
     * @return {Object} filtered threads that are pinned
     */
    pinnedThreads({ state }) {
        const filteredEntries = Object
            .entries(state.threads)
            .filter(([threadLocalId, thread]) => thread.isPinned);
        return Object.fromEntries(filteredEntries);
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.state
     * @param {string} threadLocalId
     * @return {string}
     */
    threadName({ state }, threadLocalId) {
        const thread = state.threads[threadLocalId];
        if (thread.channel_type === 'chat') {
            const directPartner = state.partners[thread.directPartnerLocalId];
            return thread.custom_channel_name || directPartner.name;
        }
        return thread.name;
    },
};

return getters;

});
