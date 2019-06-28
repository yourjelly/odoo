odoo.define('mail.store.mutations', function (require) {
"use strict";

const emojis = require('mail.emojis');
const mailUtils = require('mail.utils');

const AttachmentViewer = require('mail.component.AttachmentViewer');

const core = require('web.core');
const time = require('web.time');

const _t = core._t;

const { Observer } = owl;

/**
 * @private
 * @param {Object} param0
 * @param {string|undefined} [param0.checksum]
 * @param {string|undefined} param0.fileType
 * @param {integer} param0.id
 * @param {string} [param0.url]
 * @return {string|undefined}
 */
function _computeAttachmentDefaultSource({ checksum, fileType, id, url }) {
    if (fileType === 'image') {
        return `/web/image/${id}?unique=1&amp;signature=${checksum}&amp;model=ir.attachment`;
    }
    if (fileType === 'application/pdf') {
        return `/web/static/lib/pdfjs/web/viewer.html?file=/web/content/${id}?model%3Dir.attachment`;
    }
    if (fileType && fileType.indexOf('text') !== -1) {
        return `/web/content/${id}?model%3Dir.attachment`;
    }
    if (fileType === 'youtu') {
        const token = _computeAttachmentDefaultSourceYoutubeToken({ fileType, url });
        return `https://www.youtube.com/embed/${token}`;
    }
    if (fileType === 'video') {
        return `/web/image/${id}?model=ir.attachment`;
    }
    return undefined;
}

/**
 * @private
 * @param {Object} param0
 * @param {string|undefined} param0.fileType
 * @param {string} param0.url
 * @return {string|undefined}
 */
function _computeAttachmentDefaultSourceYoutubeToken({ fileType, url }) {
    if (fileType !== 'youtu') {
        return undefined;
    }
    const urlArr = url.split('/');
    let token = urlArr[urlArr.length-1];
    if (token.indexOf('watch') !== -1) {
        token = token.split('v=')[1];
        const amp = token.indexOf('&');
        if (amp !== -1){
            token = token.substring(0, amp);
        }
    }
    return token;
}

/**
 * @private
 * @param {Object} param0
 * @param {string} [param0.mimetype]
 * @param {string} [param0.type]
 * @param {string} [param0.url]
 * @return {string|undefined}
 */
function _computeAttachmentFiletype({ mimetype, type, url }) {
    if (type === 'url' && !url) {
        return undefined;
    } else if (!mimetype) {
        return undefined;
    }
    const match = type === 'url'
        ? url.match('(youtu|.png|.jpg|.gif)')
        : mimetype.match('(image|video|application/pdf|text)');
    if (!match) {
        return undefined;
    }
    if (match[1].match('(.png|.jpg|.gif)')) {
        return 'image';
    }
    return match[1];
}

/**
 * @private
 * @return {string}
 */
function _computeMessageBodyWithLinks(body) {
    for (let emoji of emojis) {
        const { unicode } = emoji;
        let regexp = new RegExp(
            `(?:^|\\s|<[a-z]*>)(${unicode})(?=\\s|$|</[a-z]*>)`,
            "g"
        );
        let originalBody = body;
        body = body.replace(
            regexp,
            ` <span class="o_mail_emoji">${unicode}</span> `
        );
        // Idiot-proof limit. If the user had the amazing idea of
        // copy-pasting thousands of emojis, the image rendering can lead
        // to memory overflow errors on some browsers (e.g. Chrome). Set an
        // arbitrary limit to 200 from which we simply don't replace them
        // (anyway, they are already replaced by the unicode counterpart).
        if (_.str.count(body, "o_mail_emoji") > 200) {
            body = originalBody;
        }
    }
    // add anchor tags to urls
    return mailUtils.parseAndTransform(body, mailUtils.addLink);
}

/**
 * @private
 * @param {Object} param0
 * @param {integer[]} [param0.channel_ids=[]]
 * @param {mail.store.model.Partner} param0.currentPartner
 * @param {string} [param0.model]
 * @param {integer[]} [param0.needaction_partner_ids=[]]
 * @param {integer} [param0.res_id]
 * @param {integer[]} [param0.starred_partner_ids=[]]
 * @return {mail.store.model.Thread[]}
 */
function _computeMessageThreadLocalIds({
    channel_ids=[],
    currentPartner,
    model,
    needaction_partner_ids=[],
    res_id,
    starred_partner_ids=[],
}) {
    let threadLocalIds = channel_ids.map(id => `mail.channel_${id}`);
    if (needaction_partner_ids.includes(currentPartner.id)) {
        threadLocalIds.push('mail.box_inbox');
    }
    if (starred_partner_ids.includes(currentPartner.id)) {
        threadLocalIds.push('mail.box_starred');
    }
    if (model && res_id) {
        const originThreadLocalId = `${model}_${res_id}`;
        if (originThreadLocalId && !threadLocalIds.includes(originThreadLocalId)) {
            threadLocalIds.push(originThreadLocalId);
        }
    }
    return threadLocalIds;
}

const mutations = {

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {string} chatWindowId either 'new_message' or thread local Id, a
     *   valid Id in `chatWindowIds` list of chat window manager.
     */
    closeChatWindow({ commit, state }, chatWindowId) {
        const cwm = state.chatWindowManager;
        cwm.chatWindowIds = cwm.chatWindowIds.filter(i => i !== chatWindowId);
        if (chatWindowId !== 'new_message') {
            commit('updateThread', chatWindowId, {
                fold_state: 'closed',
                is_minimized: false,
            });
        }
        commit('_computeChatWindows');
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.state
     * @param {string} dialogId
     */
    closeDialog({ state }, dialogId) {
        state.dialogManager.dialogs = state.dialogManager.dialogs.filter(item =>
            item.id !== dialogId);
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     */
    closeDiscuss({ commit, state }) {
        if (!state.discuss.isOpen) {
            return;
        }
        Object.assign(state.discuss, {
            domain: [],
            isOpen: false,
            stringifiedDomain: '[]',
            threadLocalId: undefined,
        });
        commit('_computeChatWindows');
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} data
     * @param {string} data.filename
     * @param {integer} [data.id]
     * @param {boolean} [data.isTemporary=false]
     * @param {string} [data.mimetype]
     * @param {string} [data.name]
     * @param {integer} [data.size]
     * @param {boolean} [data.uploaded=false]
     * @param {boolean} [data.uploading=false]
     * @return {string} attachment local Id
     */
    createAttachment({ commit, state }, data) {
        let {
            filename,
            id,
            isTemporary=false,
            mimetype,
            name,
            res_id,
            res_model,
            size,
            uploaded=false,
            uploading=false,
        } = data;
        if (isTemporary) {
            id = state.attachmentNextTemporaryId;
            mimetype = '';
            state.attachmentNextTemporaryId--;
        }
        const attachment = {
            filename,
            id,
            isTemporary,
            mimetype,
            name,
            res_id,
            res_model,
            size,
            uploaded,
            uploading,
        };

        commit('_computeAttachment', attachment);
        Observer.set(state.attachments, attachment.localId, attachment);
        if (isTemporary) {
            Observer.set(
                state.temporaryAttachmentLocalIds,
                attachment.displayFilename,
                attachment.localId);
        }
        return attachment.localId;
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {Array} [param1.author_id]
     * @param {integer} [param1.author_id[0]]
     * @param {string} [param1.author_id[1]]
     * @param {integer[]} param1.channel_ids
     * @param {string|boolean} [param1.model=false]
     * @param {integer[]} param1.needaction_partner_ids
     * @param {string} param1.record_name
     * @param {integer|boolean} [param1.res_id=false]
     * @param {integer[]} param1.starred_partner_ids
     * @param {...Object} param1.kwargs
     * @return {string} message local Id
     */
    createMessage(
        { commit, state },
        {
            attachment_ids=[],
            author_id, author_id: [
                authorId,
                authorDisplayName
            ]=[],
            channel_ids,
            model,
            needaction_partner_ids,
            record_name,
            res_id,
            starred_partner_ids,
            ...kwargs
        },
    ) {
        // 1. make message
        const message = {
            attachment_ids,
            author_id,
            channel_ids,
            model,
            needaction_partner_ids,
            record_name,
            res_id,
            starred_partner_ids,
            ...kwargs
        };
        commit('_computeMessage', message);
        const messageLocalId = message.localId;
        if (state.messages[messageLocalId]) {
            console.warn(`message with local Id "${messageLocalId}" already exists in store`);
            return;
        }
        Observer.set(state.messages, messageLocalId, message);
        // 2. author: create/update + link
        if (authorId) {
            const partnerLocalId = commit('insertPartner', {
                display_name: authorDisplayName,
                id: authorId,
            });
            commit('_linkMessageToPartner', {
                messageLocalId,
                partnerLocalId,
            });
        }
        // 3. threads: create/update + link
        if (message.originThreadLocalId) {
            commit('insertThread', {
                _model: model,
                id: res_id,
            });
            if (message.record_name) {
                commit('updateThread', message.originThreadLocalId, {
                    name: record_name,
                });
            }
        }
        // 3a. link message <- threads
        for (const threadLocalId of message.threadLocalIds) {
            const threadCacheLocalId = `${threadLocalId}_[]`;
            if (!state.threadCaches[threadCacheLocalId]) {
                commit('createThreadCache', { threadLocalId });
            }
            commit('_linkMessageToThreadCache', {
                messageLocalId,
                threadCacheLocalId,
            });
        }
        // 4. attachments: create/update + link
        for (const data of attachment_ids) {
            commit('insertAttachment', data);
        }

        return message.localId;
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {Object[]} [param1.direct_partner]
     * @param {boolean} [param1.isPinned=true]
     * @param {Array} [param1.members=[]]
     * @param {...Object} param1.kwargs
     * @return {string} thread local Id
     */
    createThread(
        { commit, state },
        {
            direct_partner,
            is_minimized,
            isPinned=true,
            members=[],
            ...kwargs
        }
    ) {
        const thread = {
            direct_partner,
            is_minimized,
            isPinned,
            members,
            ...kwargs
        };
        commit('_computeThread', thread);
        const threadLocalId = thread.localId;
        if (state.threads[threadLocalId]) {
            console.warn(`already exists thread with local Id ${threadLocalId} in store`);
            return;
        }
        /* Update thread data */
        Observer.set(state.threads, threadLocalId, thread);
        /* Update thread relationships */
        for (const member of members) {
            commit('insertPartner', member);
        }
        if (direct_partner && direct_partner[0]) {
            commit('insertPartner', direct_partner[0]);
        }
        if (is_minimized) {
            commit('openChatWindow', threadLocalId);
        }
        return threadLocalId;
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} [param1.stringifiedDomain='[]']
     * @param {string} param1.threadLocalId
     * @return {string} thread cache local Id
     */
    createThreadCache(
        { commit, state },
        { stringifiedDomain='[]', threadLocalId }
    ) {
        const threadCache = {
            stringifiedDomain,
            threadLocalId,
        };
        commit('_computeThreadCache', threadCache);
        const threadCacheLocalId = threadCache.localId;
        Observer.set(state.threadCaches, threadCacheLocalId, threadCache);
        commit('_linkThreadCacheToThread', {
            threadCacheLocalId,
            threadLocalId,
        });
        return threadCacheLocalId;
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.state
     * @param {string} attachmentLocalId
     */
    deleteAttachment({ state }, attachmentLocalId) {
        const attachment = state.attachments[attachmentLocalId];
        Observer.delete(state.attachments, attachmentLocalId);
        if (attachment.isTemporary) {
            Observer.delete(
                state.temporaryAttachmentLocalIds,
                attachment.displayFilename);
        }
    },
    /**
     * Unused for the moment, but may be useful for moderation
     *
     * @param {Object} param0
     * @param {Object} param0.state
     * @param {string} messageLocalId
     */
    deleteMessage({ commit, state }, messageLocalId) {
        delete state.messages[messageLocalId];
        for (const cache of Object.values(state.threadCaches)) {
            if (cache.messageLocalIds.includes(messageLocalId)) {
                commit('updateThreadCache', cache.localId, {
                    messageLocalIds: cache.messageLocalIds.filter(localId =>
                        localId !== messageLocalId),
                });
            }
        }
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {integer} param1.globalInnerHeight
     * @param {integer} param1.globalInnerWidth
     * @param {boolean} param1.isMobile
     */
    handleGlobalResize({ commit, state }, {
        globalInnerHeight,
        globalInnerWidth,
        isMobile,
    }) {
        state.global.innerHeight = globalInnerHeight;
        state.global.innerWidth = globalInnerWidth;
        state.isMobile = isMobile; // config.device.isMobile;
        commit('_computeChatWindows');
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {...Object} param1.data
     */
    handleNotificationNeedaction({ commit, state }, { ...data }) {
        const message = commit('insertMessage', { ...data });
        state.threads['mail.box_inbox'].counter++;
        for (const threadLocalId of message.threadLocalIds) {
            const thread = state.threads[threadLocalId];
            if (
                thread.channel_type === 'channel' &&
                message.needaction_partner_ids.includes(state.partners[state.currentPartnerLocalId])
            ) {
                commit('updateThread', threadLocalId, {
                    message_needaction_counter: thread.message_needaction_counter + 1,
                });
            }
        }
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.getters
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {integer[]} [param1.message_ids=[]]
     */
    handleNotificationPartnerMarkAsRead(
        { commit, getters, state },
        { message_ids=[] }
    ) {
        const inboxLocalId = 'mail.box_inbox';
        const inbox = state.threads[inboxLocalId];
        for (const cacheLocalId of inbox.cacheLocalIds) {
            for (const messageId of message_ids) {
                const messageLocalId = `mail.message_${messageId}`;
                commit('_unlinkMessageFromThreadCache', {
                    messageLocalId,
                    threadCacheLocalId: cacheLocalId,
                });
            }
        }
        const mailChannelList = getters.mailChannelList();
        for (const mailChannel of mailChannelList) {
            commit('updateThread', mailChannel.localId, {
                message_needaction_counter: 0,
            });
        }
        commit('updateThread', inboxLocalId, {
            counter: inbox.counter - message_ids.length,
        });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {integer[]} param1.message_ids
     * @param {boolean} param1.starred
     */
    handleNotificationPartnerToggleStar(
        { commit, state },
        { message_ids=[], starred }
    ) {
        const starredBoxLocalId = 'mail.box_starred';
        const starredBox = state.threads[starredBoxLocalId];
        const starredBoxMainCacheLocalId = `${starredBoxLocalId}_[]`;
        if (!state.threadCaches[starredBoxMainCacheLocalId]) {
            commit('createThreadCache', {
                threadLocalId: starredBoxLocalId,
            });
        }
        for (const messageId of message_ids) {
            const messageLocalId = `mail.message_${messageId}`;
            const message = state.messages[messageLocalId];
            if (!message) {
                continue;
            }
            if (starred) {
                commit('_setMessageStar', messageLocalId);
                commit('updateThread', starredBoxLocalId, {
                    counter: starredBox.counter + 1,
                });
            } else {
                commit('_unsetMessageStar', messageLocalId);
                commit('updateThread', starredBoxLocalId, {
                    counter: starredBox.counter - 1,
                });
            }
        }
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {Array} [param1.author_id]
     * @param {...Object} param1.kwargs
     */
    handleNotificationPartnerTransientMessage(
        { commit, state },
        { author_id, ...kwargs }
    ) {
        const { length: l, [l - 1]: lastMessage } = Object.values(state.messages);
        commit('createMessage', {
            ...kwargs,
            author_id: author_id || state.partners.odoobot.localId,
            id: (lastMessage ? lastMessage.id : 0) + 0.01
        });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {string} threadLocalId
     * @param {Object} param2
     * @param {Object} param2.messageData
     * @param {Array} [param2.searchDomain=[]]
     */
    handleThreadLoaded(
        { commit, state },
        threadLocalId,
        { messagesData, searchDomain=[] }
    ) {
        const stringifiedDomain = JSON.stringify(searchDomain);
        const threadCacheLocalId = commit('_insertThreadCache', {
            allHistoryLoaded: messagesData.length < state.MESSAGE_FETCH_LIMIT,
            loaded: true,
            loading: false,
            loadingMore: false,
            stringifiedDomain,
            threadLocalId,
        });
        for (const data of messagesData) {
            const messageLocalId = commit('insertMessage', data);
            commit('_linkMessageToThreadCache', {
                messageLocalId,
                threadCacheLocalId,
            });
        }
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {Object} param1.channel_slots
     * @param {Array} [param1.commands=[]]
     * @param {Object} param1.currentPartnerData
     * @param {string} param1.currentPartnerData.displayName
     * @param {integer} param1.currentPartnerData.id
     * @param {string} param1.currentPartnerData.name
     * @param {integer} param1.currentPartnerData.userId
     * @param {boolean} [param1.is_moderator=false]
     * @param {Object[]} [param1.mail_failures=[]]
     * @param {Object[]} [param1.mention_partner_suggestions=[]]
     * @param {Object[]} [param1.moderation_channel_ids=[]]
     * @param {integer} [param1.moderation_counter=0]
     * @param {integer} [param1.needaction_inbox_counter=0]
     * @param {Object[]} [param1.shortcodes=[]]
     * @param {integer} [param1.starred_counter=0]
     */
    initMessaging(
        { commit, state },
        {
            channel_slots,
            commands=[],
            currentPartnerData: {
                displayName: currentPartnerDisplayName,
                id: currentPartnerId,
                name: currentPartnerName,
                userId: currentPartnerUserId,
            },
            is_moderator=false,
            mail_failures=[],
            mention_partner_suggestions=[],
            menu_id,
            moderation_channel_ids=[],
            moderation_counter=0,
            needaction_inbox_counter=0,
            shortcodes=[],
            starred_counter=0
        }
    ) {
        commit('_initMessagingPartners', {
            currentPartner: {
                displayName: currentPartnerDisplayName,
                id: currentPartnerId,
                name: currentPartnerName,
                userId: currentPartnerUserId,
            },
        });
        commit('_initMessagingCommands', commands); // required for channels, hence before
        commit('_initMessagingChannels', channel_slots);
        commit('_initMessagingMailboxes', {
            is_moderator,
            moderation_counter,
            needaction_inbox_counter,
            starred_counter
        });
        commit('_initMessagingMailFailures', mail_failures);
        commit('_initMessagingCannedResponses', shortcodes);
        commit('_initMessagingMentionPartnerSuggestions', mention_partner_suggestions);
        state.discuss.menu_id = menu_id;
    },
    /**
     * Update existing attachment or create a new attachment
     *
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {integer} param1.id
     * @param {...Object} param1.kwargs
     * @return {string} attachment local Id
     */
    insertAttachment({ commit, state }, { id, ...kwargs }) {
        const attachmentLocalId = `ir.attachment_${id}`;
        if (!state.attachments[attachmentLocalId]) {
            commit('createAttachment', { id, ...kwargs });
        } else {
            commit('_updateAttachment', attachmentLocalId, kwargs);
        }
        return attachmentLocalId;
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {integer} param1.id
     * @param {...Object} param1.kwargs
     * @return {string} message local Id
     */
    insertMessage({ commit, state }, { id, ...kwargs }) {
        const messageLocalId = `mail.message_${id}`;
        if (!state.messages[messageLocalId]) {
            commit('createMessage', { id, ...kwargs });
        } else {
            commit('_updateMessage', messageLocalId, kwargs);
        }
        return messageLocalId;
    },
    /**
     * Update existing partner or create a new partner
     *
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {integer} param1.id
     * @param {...Object} param1.kwargs
     * @return {string} partner local Id
     */
    insertPartner({ commit, state }, { id, ...kwargs }) {
        const partnerLocalId = `res.partner_${id}`;
        if (!state.partners[partnerLocalId]) {
            commit('_createPartner', { id, ...kwargs });
        } else {
            commit('updatePartner', partnerLocalId, kwargs);
        }
        return partnerLocalId;
    },
    /**
     * Update existing thread or create a new thread
     *
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1._model
     * @param {integer} param1.id
     * @param {...Object} param1.kwargs
     * @return {string} thread local Id
     */
    insertThread({ commit, state }, { _model, id, ...kwargs }) {
        const threadLocalId = `${_model}_${id}`;
        if (!state.threads[threadLocalId]) {
            commit('createThread', { _model, id, ...kwargs });
        } else {
            commit('updateThread', threadLocalId, kwargs);
        }
        return threadLocalId;
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {string} chatWindowId chat window Id that is invisible
     */
    makeChatWindowVisible({ commit, state }, chatWindowId) {
        const cwm = state.chatWindowManager;
        const {
            length: l,
            [l-1]: { chatWindowId: lastVisibleChatWindowId }
        } = cwm.computed.visible;
        commit('_swapChatWindows', chatWindowId, lastVisibleChatWindowId);
        const thread = state.threads[chatWindowId];
        if (thread && thread.fold_state !== 'open') {
            commit('updateThread', chatWindowId, {
                fold_state: 'open',
            });
        }
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {string} chatWindowId either a thread local Id or
     *   'new_message', if the chat window is already in `chatWindowIds` and
     *   visible, simply focuses it. If it is already in `chatWindowIds` and
     *   invisible, it swaps with last visible chat window. New chat window
     *   is added based on provided mode.
     * @param {Object} param2
     * @param {boolean} [param2.focus=true]
     * @param {string} [param2.mode='last'] either 'last' or 'last_visible'
     */
    openChatWindow(
        { commit, state },
        chatWindowId,
        { focus=true, mode='last' }
    ) {
        const cwm = state.chatWindowManager;
        const thread = state.threads[chatWindowId];
        if (cwm.chatWindowIds.includes(chatWindowId)) {
            // open already minimized chat window
            if (mode === 'last_visible' && cwm.computed.hidden.chatWindowIds.includes(chatWindowId)) {
                commit('makeChatWindowVisible', chatWindowId);
            }
        } else {
            // new chat window
            cwm.chatWindowIds.push(chatWindowId);
            if (chatWindowId !== 'new_message') {
                commit('updateThread', chatWindowId, {
                    fold_state: 'open',
                    is_minimized: true,
                });
            }
            commit('_computeChatWindows');
            if (mode === 'last_visible') {
                commit('makeChatWindowVisible', chatWindowId);
            }
        }
        if (thread && thread.fold_state !== 'open') {
            commit('updateThread', chatWindowId, {
                fold_state: 'open',
            });
        }
        if (focus) {
            commit('_focusChatWindow', chatWindowId);
        }
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {string} oldChatWindowId chat window to replace
     * @param {string} newChatWindowId chat window to replace with
     */
    replaceChatWindow({ commit, state }, oldChatWindowId, newChatWindowId) {
        commit('_swapChatWindows', newChatWindowId, oldChatWindowId);
        commit('closeChatWindow', oldChatWindowId);
        const thread = state.threads[newChatWindowId];
        if (thread && !thread.fold_state !== 'open') {
            commit('updateThread', newChatWindowId, {
                fold_state: 'open',
            });
        }
        commit('_focusChatWindow', newChatWindowId);
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.chatWindowId either 'new_message' or thread local Id
     */
    shiftLeftChatWindow({ commit, state }, chatWindowId) {
        const cwm = state.chatWindowManager;
        const index = cwm.chatWindowIds.findIndex(cwId => cwId === chatWindowId);
        if (index === cwm.chatWindowIds.length-1) {
            // already left-most
            return;
        }
        const otherChatWindowId = cwm.chatWindowIds[index+1];
        Observer.set(cwm.chatWindowIds, index, otherChatWindowId);
        Observer.set(cwm.chatWindowIds, index+1, chatWindowId);
        commit('_computeChatWindows');
        commit('_focusChatWindow', chatWindowId);
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {string} chatWindowId either 'new_message' or thread local Id
     */
    shiftRightChatWindow({ commit, state }, chatWindowId) {
        const cwm = state.chatWindowManager;
        const index = cwm.chatWindowIds.findIndex(cwId => cwId === chatWindowId);
        if (index === 0) {
            // already right-most
            return;
        }
        const otherChatWindowId = cwm.chatWindowIds[index-1];
        Observer.set(cwm.chatWindowIds, index, otherChatWindowId);
        Observer.set(cwm.chatWindowIds, index-1, chatWindowId);
        commit('_computeChatWindows');
        commit('_focusChatWindow', chatWindowId);
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {string} threadLocalId
     */
    toggleFoldThread({ commit, state }, threadLocalId) {
        const thread = state.threads[threadLocalId];
        commit('updateThread', threadLocalId, {
            fold_state: thread.fold_state === 'open' ? 'folded' : 'open',
        });
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.state
     * @param {string} threadLocalId
     */
    unpinThread({ commit }, threadLocalId) {
        commit('updateThread', threadLocalId, { isPinned: false });
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.state
     * @param {Object} changes
     */
    updateChatWindowManager({ state }, changes) {
        Object.assign(state.chatWindowManager, changes);
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.state
     * @param {string} id
     * @param {any} changes
     */
    updateDialogInfo({ state }, id, changes) {
        const dialog  = state.dialogManager.dialogs.find(dialog => dialog.id === id);
        if (!dialog) {
            return;
        }
        Object.assign(dialog.info, changes);
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} changes
     * @param {Array} [changes.domain]
     * @param {boolean} [changes.isOpen]
     * @param {string} [changes.threadLocalId]
     */
    updateDiscuss({ commit, state }, changes) {
        if (changes.stringifiedDomain) {
            throw new Error('cannot set stringified domain on discuss state (read-only)');
        }
        let shouldRecomputeStringifiedDomain = false;
        if ('domain' in changes) {
            shouldRecomputeStringifiedDomain = true;
        } else if (
            'threadLocalId' in changes &&
            changes.threadLocalId !== state.discuss.threadLocalId
        ) {
            shouldRecomputeStringifiedDomain = true;
        }
        if ('isOpen' in changes) {
            if (changes.isOpen) {
                commit('_openDiscuss');
            } else {
                commit('closeDiscuss');
            }
        }
        Object.assign(state.discuss, changes);
        if (shouldRecomputeStringifiedDomain) {
            state.discuss.stringifiedDomain = JSON.stringify(state.discuss.domain);
        }
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {string} partnerLocalId
     * @param {Object} changes
     */
    updatePartner({ commit, state }, partnerLocalId, changes) {
        const partner = state.partners[partnerLocalId];
        Object.assign(partner, changes);
        commit('_computePartner', partner);
        // todo: changes of links, e.g. messageLocalIds
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {string} threadLocalId
     * @param {Object} changes
     * @param {boolean} [changes.is_minimized]
     */
    updateThread({ commit, state }, threadLocalId, changes) {
        const thread = state.threads[threadLocalId];
        const wasMinimized = thread.is_minimized;
        Object.assign(thread, changes);
        commit('_computeThread', thread);
        const cwm = state.chatWindowManager;
        if (
            !wasMinimized &&
            thread.is_minimized &&
            !cwm.chatWindowIds.includes(threadLocalId)
        ) {
            commit('openChatWindow', threadLocalId);
        }
        if (
            wasMinimized &&
            !thread.is_minimized &&
            cwm.chatWindowIds.includes(threadLocalId)
        ) {
            commit('closeChatWindow', threadLocalId);
        }
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {string} threadCacheLocalId
     * @param {Object} changes
     */
    updateThreadCache({ commit, state }, threadCacheLocalId, changes) {
        const threadCache = state.threadCaches[threadCacheLocalId];
        Object.assign(threadCache, changes);
        commit('_computeThreadCache', threadCache);
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param1
     * @param {string|undefined} [param1.attachmentLocalId]
     * @param {string[]} param1.attachmentLocalIds
     * @return {string|undefined} unique id of open dialog, if open
     */
    viewAttachments({ commit }, { attachmentLocalId, attachmentLocalIds }) {
        if (!attachmentLocalIds) {
            return;
        }
        if (!attachmentLocalId) {
            attachmentLocalId = attachmentLocalIds[0];
        }
        if (!attachmentLocalIds.includes(attachmentLocalId)) {
            return;
        }
        return commit('_openDialog', AttachmentViewer, {
            attachmentLocalId,
            attachmentLocalIds,
        });
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {Object} param0
     * @param {Object} param0.state
     */
    _computeChatWindows({ state }) {
        const BETWEEN_GAP_WIdTH = 5;
        const CHAT_WINDOW_WIdTH = 325;
        const END_GAP_WIdTH = 10;
        const GLOBAL_WIdTH = state.global.innerWidth;
        const HIdDEN_MENU_WIdTH = 200; // max width, including width of dropup list items
        const START_GAP_WIdTH = 10;
        const cwm = state.chatWindowManager;
        const isDiscussOpen = state.discuss.isOpen;
        const isMobile = state.isMobile;
        const chatWindowIds = cwm.chatWindowIds;
        let computed = {
            /**
             * Amount of visible slots available for chat windows.
             */
            availableVisibleSlots: 0,
            /**
             * Data related to the hidden menu.
             */
            hidden: {
                /**
                 * List of hidden chat windows. Useful to compute counter.
                 * Chat windows are ordered by their `chatWindowIds` order.
                 */
                chatWindowIds: [],
                /**
                 * Offset of hidden menu starting point from the starting point
                 * of chat window manager. Makes only sense if it is visible.
                 */
                offset: 0,
                /**
                 * Whether hidden menu is visible or not
                 */
                showMenu: false,
            },
            /**
             * Data related to visible chat windows. Index determine order of
             * chat windows. Value: { chatWindowId, offset }.
             * Offset is offset of starting point of chat window from starting
             * point of chat window manager. Chat windows are ordered by their
             * `chatWindowIds` order
             */
            visible: [],
        };
        if (isMobile || isDiscussOpen) {
            cwm.computed = computed;
            return;
        }
        if (!chatWindowIds.length) {
            cwm.computed = computed;
            return;
        }
        const relativeGlobalWidth = GLOBAL_WIdTH - START_GAP_WIdTH - END_GAP_WIdTH;
        const maxAmountWithoutHidden = Math.floor(
            relativeGlobalWidth / (CHAT_WINDOW_WIdTH + BETWEEN_GAP_WIdTH));
        const maxAmountWithHidden = Math.floor(
            (relativeGlobalWidth - HIdDEN_MENU_WIdTH - BETWEEN_GAP_WIdTH) /
            (CHAT_WINDOW_WIdTH + BETWEEN_GAP_WIdTH));
        if (chatWindowIds.length <= maxAmountWithoutHidden) {
            // all visible
            for (let i = 0; i < chatWindowIds.length; i++) {
                const chatWindowId = chatWindowIds[i];
                const offset = START_GAP_WIdTH + i * (CHAT_WINDOW_WIdTH + BETWEEN_GAP_WIdTH);
                computed.visible.push({ chatWindowId, offset });
            }
            computed.availableVisibleSlots = maxAmountWithoutHidden;
        } else if (maxAmountWithHidden > 0) {
            // some visible, some hidden
            let i;
            for (i = 0; i < maxAmountWithHidden; i++) {
                const chatWindowId = chatWindowIds[i];
                const offset = START_GAP_WIdTH + i * ( CHAT_WINDOW_WIdTH + BETWEEN_GAP_WIdTH );
                computed.visible.push({ chatWindowId, offset });
            }
            if (chatWindowIds.length > maxAmountWithHidden) {
                computed.hidden.showMenu = true;
                computed.hidden.offset = computed.visible[i-1].offset
                    + CHAT_WINDOW_WIdTH + BETWEEN_GAP_WIdTH;
            }
            for (let j = maxAmountWithHidden; j < chatWindowIds.length; j++) {
                computed.hidden.chatWindowIds.push(chatWindowIds[j]);
            }
            computed.availableVisibleSlots = maxAmountWithHidden;
        } else {
            // all hidden
            computed.hidden.showMenu = true;
            computed.hidden.offset = START_GAP_WIdTH;
            computed.hidden.chatWindowIds.concat(chatWindowIds);
            console.warn('cannot display any visible chat windows (screen is too small)');
            computed.availableVisibleSlots = 0;
        }
        cwm.computed = computed;
    },
    /**
     * @private
     * @param {Object} unused
     * @param {mail.store.model.Attachment} attachment
     */
    _computeAttachment(unused, attachment) {
        const {
            checksum,
            filename,
            id,
            mimetype,
            name,
            type,
            url,
        } = attachment;

        const displayFilename = filename || name;
        const fileType = _computeAttachmentFiletype({ mimetype, type, url });
        const isTextFile = (fileType && fileType.indexOf('text') !== -1) || false;

        const mediaType = mimetype && mimetype.split('/').shift();
        Object.assign(attachment, {
            _model: 'ir.attachment',
            defaultSource: _computeAttachmentDefaultSource({
                checksum,
                fileType,
                id,
                url,
            }),
            displayFilename,
            displayName: name || filename,
            extension: displayFilename && displayFilename.split('.').pop(),
            fileType,
            isTextFile,
            isViewable: mediaType === 'image' ||
                mediaType === 'video' ||
                mimetype === 'application/pdf' ||
                isTextFile,
            localId: `ir.attachment_${id}`,
            mediaType,
        });
    },
    /**
     * @private
     * @param {Object} unused
     * @param {mail.store.model.MailFailure} mailFailure
     */
    _computeMailFailure(unused, mailFailure) {
        const { message_id } = mailFailure;
        Object.assign(mailFailure, {
            _model: 'mail.failure',
            localId: `mail.failure_${message_id}`,
        });
        // /**
        //  * Get a valid object for the 'mail.preview' template
        //  *
        //  * @returns {Object}
        //  */
        // getPreview: function () {
        //     var preview = {
        //         body: _t("An error occured when sending an email"),
        //         date: this._lastMessageDate,
        //         documentId: this.documentId,
        //         documentModel: this.documentModel,
        //         id: 'mail_failure',
        //         imageSRC: this._moduleIcon,
        //         title: this._modelName,
        //     };
        //     return preview;
        // },
    },
    /**
     * @private
     * @param {Object} param0
     * @param {Object} param0.state
     * @param {mail.store.model.Message} message
     */
    _computeMessage({ state }, message) {
        const {
            attachment_ids,
            author_id,
            body,
            channel_ids,
            date,
            id,
            model,
            needaction_partner_ids,
            res_id,
            starred_partner_ids,
        } = message;

        Object.assign(message, {
            _model: 'mail.message',
            attachmentLocalIds: attachment_ids.map(({ id }) => `ir.attachment_${id}`),
            authorLocalId: author_id ? `res.partner_${author_id[0]}` : undefined,
            body,
            bodyWithLinks: _computeMessageBodyWithLinks(body),
            dateMoment: date ? moment(time.str_to_datetime(date)) : moment(),
            localId: `mail.message_${id}`,
            originThreadLocalId: res_id && model ? `${model}_${res_id}` : undefined,
            threadLocalIds: _computeMessageThreadLocalIds({
                channel_ids,
                currentPartner: state.partners[state.currentPartnerLocalId],
                model,
                needaction_partner_ids,
                res_id,
                starred_partner_ids,
            }),
        });
    },
    /**
     * @private
     * @param {Object} unused
     * @param {mail.store.model.Partner} partner
     */
    _computePartner(unused, partner) {
        const {
            id,
            display_name,
            messageLocalIds=[],
            name,
        } = partner;

        Object.assign(partner, {
            _model: 'res.partner',
            displayName: name || display_name,
            localId: `res.partner_${id}`,
            messageLocalIds,
        });
    },
    /**
     * @private
     * @param {Object} unused
     * @param {mail.store.model.Thread} thread
     */
    _computeThread(unused, thread) {
        let {
            _model,
            cacheLocalIds=[],
            channel_type,
            direct_partner: [{
                id: directPartnerId,
                im_status: directPartnerImStatus,
                email: directPartnerEmail,
                name: directPartnerName,
            }={}]=[],
            id,
            members=[],
            typingMemberLocalIds=[],
        } = thread;

        if (!_model && channel_type) {
            _model = 'mail.channel';
        }
        if (!_model || !id) {
            throw new Error('thread must always have `model` and `id`');
        }

        if (directPartnerId) {
            thread.directPartnerLocalId = `res.partner_${directPartnerId}`;
        }

        Object.assign(thread, {
            _model,
            cacheLocalIds,
            localId: `${_model}_${id}`,
            memberLocalIds: members.map(member => `res.partner_${member.id}`),
            typingMemberLocalIds,
        });
    },
    /**
     * @private
     * @param {Object} unused
     * @param {mail.store.model.ThreadCache} threadCache
     */
    _computeThreadCache(unused, threadCache) {
        let {
            allHistoryLoaded=false,
            loaded=false,
            loading=false,
            loadingMore=false,
            messageLocalIds=[],
            stringifiedDomain,
            threadLocalId,
        } = threadCache;

        if (loaded) {
            loading = false;
        }

        Object.assign(threadCache, {
            allHistoryLoaded,
            loaded,
            loading,
            loadingMore,
            localId: `${threadLocalId}_${stringifiedDomain}`,
            messageLocalIds,
        });
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {integer} param1.id
     * @param {string} [param1.im_status]
     * @param {string} [param1.email]
     * @param {string} [param1.name]
     * @return {string} partner local Id
     */
    _createPartner({ commit, state }, data) {
        const partner = { ...data };
        commit('_computePartner', partner);
        const partnerLocalId = partner.localId;
        if (state.partners[partnerLocalId]) {
            console.warn(`partner with local Id "${partnerLocalId}" already exists in store`);
            return;
        }
        Observer.set(state.partners, partnerLocalId, partner);
        // todo: links
        return partnerLocalId;
    },
    /**
     * @private
     * @param {Object} param0
     * @param {Object} param0.state
     * @param {string} chatWindowId either 'new_message' or minimized thread
     *   local Id, a valid caht window in `chatWindowIds` list of chat
     *   window manager
     */
    _focusChatWindow({ state }, chatWindowId) {
        const cwm = state.chatWindowManager;
        if (!cwm.computed.visible.map(v => v.chatWindowId).includes(chatWindowId)) {
            return;
        }
        cwm.autofocusChatWindowId = chatWindowId;
        cwm.autofocusCounter++;
    },
    /**
     * @private
     * @param {Object} param0
     * @param {Object} param0.state
     * @param {Object[]} shortcodes
     */
    _initMessagingCannedResponses({ state }, shortcodes) {
        const cannedResponses = shortcodes
            .map(s => {
                const { id, source, substitution } = s;
                return { id, source, substitution };
            })
            .reduce((obj, cr) => {
                obj[cr.id] = cr;
                return obj;
            }, {});
        Object.assign(state, { cannedResponses });
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param1
     * @param {Object[]} [param1.channel_channel=[]]
     * @param {Object[]} [param1.channel_direct_message=[]]
     * @param {Object[]} [param1.channel_private_group=[]]
     */
    _initMessagingChannels(
        { commit },
        {
            channel_channel=[],
            channel_direct_message=[],
            channel_private_group=[],
        }
    ) {
        for (const data of channel_channel) {
            commit('insertThread', { _model: 'mail.channel', ...data });
        }
        for (const data of channel_direct_message) {
            commit('insertThread', { _model: 'mail.channel', ...data });
        }
        for (const data of channel_private_group) {
            commit('insertThread', { _model: 'mail.channel', ...data });
        }
    },
    /**
     * @private
     * @param {Object} param0
     * @param {Object} param0.state
     * @param {Object[]} commandsData
     */
    _initMessagingCommands({ state }, commandsData) {
        const commands = commandsData
            .map(command => {
                return {
                    id: command.name,
                    ...command
                };
            })
            .reduce((obj, command) => {
                obj[command.id] = command;
                return obj;
            }, {});
        Object.assign(state, { commands });
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param1
     * @param {boolean} param1.is_moderator
     * @param {integer} param1.moderation_counter
     * @param {integer} param1.needaction_inbox_counter
     * @param {integer} param1.starred_counter
     */
    _initMessagingMailboxes(
        { commit },
        {
            is_moderator,
            moderation_counter,
            needaction_inbox_counter,
            starred_counter
        }
    ) {
        commit('createThread', {
            _model: 'mail.box',
            counter: needaction_inbox_counter,
            id: 'inbox',
            name: _t("Inbox"),
        });
        commit('createThread', {
            _model: 'mail.box',
            counter: starred_counter,
            id: 'starred',
            name: _t("Starred"),
        });
        if (is_moderator) {
            commit('createThread', {
                _model: 'mail.box',
                counter: moderation_counter,
                id: 'moderation',
                name: _t("Moderate Messages"),
            });
        }
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object[]} mailFailuresData
     */
    _initMessagingMailFailures({ commit, state }, mailFailuresData) {
        for (const data of mailFailuresData) {
            const mailFailure = { ...data };
            commit('_computeMailFailure', mailFailure);
            Observer.set(state.mailFailures, mailFailure.localId, mailFailure);
        }
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object[]} mentionPartnerSuggestionsData
     */
    _initMessagingMentionPartnerSuggestions({ commit }, mentionPartnerSuggestionsData) {
        for (const suggestions of mentionPartnerSuggestionsData) {
            for (const suggestion of suggestions) {
                const { email, id, name } = suggestion;
                commit('insertPartner', { email, id, name });
            }
        }
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {Object} param1.currentPartner
     * @param {string} param1.currentPartnerData.displayName
     * @param {integer} param1.currentPartnerData.id
     * @param {string} param1.currentPartnerData.name
     * @param {integer} param1.currentPartnerData.userId
     */
    _initMessagingPartners(
        { commit, state },
        {
            currentPartner: {
                displayName: currentPartnerDisplayName,
                id: currentPartnerId,
                name: currentPartnerName,
                userId: currentPartnerUserId,
            },
        }
    ) {
        commit('_createPartner', {
            id: 'odoobot',
            name: _t("OdooBot"),
        });
        const currentPartnerLocalId = commit('_createPartner', {
            display_name: currentPartnerDisplayName,
            id: currentPartnerId,
            name: currentPartnerName,
            userId: currentPartnerUserId,
        });
        state.currentPartnerLocalId = currentPartnerLocalId;
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} [param1.stringifiedDomain='[]']
     * @param {string} param1.threadLocalId
     * @param {...Object} param1.kwargs
     * @return {string} thread cache local Id
     */
    _insertThreadCache(
        { commit, state },
        { stringifiedDomain='[]', threadLocalId, ...kwargs }
    ) {
        const threadCacheLocalId = `${threadLocalId}_${stringifiedDomain}`;
        if (!state.threadCaches[threadCacheLocalId]) {
            commit('createThreadCache', {
                stringifiedDomain,
                threadLocalId,
                ...kwargs,
            });
        } else {
            commit('updateThreadCache', threadCacheLocalId, kwargs);
        }
        return threadCacheLocalId;
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.messageLocalId
     * @param {string} param1.partnerLocalId
     */
    _linkMessageToPartner(
        { commit, state },
        { messageLocalId, partnerLocalId }
    ) {
        const partner = state.partners[partnerLocalId];
        if (partner.messageLocalIds.includes(messageLocalId)) {
            return;
        }
        commit('updatePartner', partnerLocalId, {
            messageLocalIds: partner.messageLocalIds.concat([messageLocalId])
        });
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.messageLocalId
     * @param {string} param1.threadCacheLocalId
     */
    _linkMessageToThreadCache(
        { commit, state },
        { messageLocalId, threadCacheLocalId }
    ) {
        const cache = state.threadCaches[threadCacheLocalId];
        const message = state.messages[messageLocalId];
        if (cache.messageLocalIds.includes(messageLocalId)) {
            return;
        }
        // message are ordered by Id
        const index = cache.messageLocalIds.findIndex(localId => {
            const otherMessage = state.messages[localId];
            return otherMessage.id > message.id;
        });
        let newMessageLocalIds = [...cache.messageLocalIds];
        if (index !== -1) {
            newMessageLocalIds.splice(index, 0, messageLocalId);
        } else {
            newMessageLocalIds.push(messageLocalId);
        }
        commit('updateThreadCache', threadCacheLocalId, {
            messageLocalIds: newMessageLocalIds,
        });
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.threadCacheLocalId
     * @param {string} param1.threadLocalId
     */
    _linkThreadCacheToThread(
        { commit, state },
        { threadCacheLocalId, threadLocalId }
    ) {
        if (!state.threads[threadLocalId]) {
            throw new Error('no thread exists for new thread cache');
        }
        const thread = state.threads[threadLocalId];
        if (thread.cacheLocalIds.includes(threadCacheLocalId)) {
            return;
        }
        commit('updateThread', threadLocalId, {
            cacheLocalIds: thread.cacheLocalIds.concat([threadCacheLocalId]),
        });
    },
    /**
     * @private
     * @param {Object} param0
     * @param {Object} param0.state
     * @param {owl.Component} Component
     * @param {any} info
     * @return {string} unique id of the newly open dialog
     */
    _openDialog({ state }, Component, info) {
        const id = _.uniqueId('o_Dialog');
        state.dialogManager.dialogs.push({
            Component,
            id,
            info,
        });
        return id;
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     */
    _openDiscuss({ commit, state }) {
        if (state.discuss.isOpen) {
            return;
        }
        state.discuss.isOpen = true;
        commit('_computeChatWindows');
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {string} messageLocalId
     */
    _setMessageStar({ commit, state }, messageLocalId) {
        const message = state.messages[messageLocalId];
        const currentPartner = state.partners[state.currentPartnerLocalId];
        if (message.starred_partner_ids.includes(currentPartner.id)) {
            return;
        }
        commit('_updateMessage', messageLocalId, {
            starred_partner_ids: message.starred_partner_ids.concat([currentPartner.id]),
        });
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {string} chatWindowId1
     * @param {string} chatWindowId2
     */
    _swapChatWindows({ commit, state }, chatWindowId1, chatWindowId2) {
        const cwm = state.chatWindowManager;
        const chatWindowIds = cwm.chatWindowIds;
        const index1 = chatWindowIds.findIndex(cwId => cwId === chatWindowId1);
        const index2 = chatWindowIds.findIndex(cwId => cwId === chatWindowId2);
        if (index1 === -1 || index2 === -1) {
            return;
        }
        Observer.set(chatWindowIds, index1, chatWindowId2);
        Observer.set(chatWindowIds, index2, chatWindowId1);
        commit('_computeChatWindows');
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.messageLocalId
     * @param {string} param1.partnerLocalId
     */
    _unlinkMessageFromPartner(
        { commit, state },
        { messageLocalId, partnerLocalId }
    ) {
        const partner = state.partners[partnerLocalId];
        if (partner.messageLocalIds.includes(messageLocalId)) {
            return;
        }
        commit('updatePartner', partnerLocalId, {
            messageLocalIds: partner.messageLocalIds.filter(localId =>
                localId !== messageLocalId),
        });
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.messageLocalId
     * @param {string} param1.threadCacheLocalId
     */
    _unlinkMessageFromThreadCache(
        { commit, state },
        { messageLocalId, threadCacheLocalId }
    ) {
        const cache = state.threadCaches[threadCacheLocalId];
        if (!cache.messageLocalIds.includes(messageLocalId)) {
            return;
        }
        commit('updateThreadCache', threadCacheLocalId, {
            messageLocalIds: cache.messageLocalIds.filter(localId =>
                localId !== messageLocalId),
        });
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {string} messageLocalId
     */
    _unsetMessageStar({ commit, state }, messageLocalId) {
        const message = state.messages[messageLocalId];
        const currentPartner = state.partners[state.currentPartnerLocalId];
        if (!message.starred_partner_ids.includes(currentPartner.id)) {
            return;
        }
        commit('_updateMessage', messageLocalId, {
            starred_partner_ids: message.starred_partner_ids.filter(id =>
                id !== currentPartner.id),
        });
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {string} attachmentLocalId
     * @param {Object} changes
     */
    _updateAttachment({ commit, state }, attachmentLocalId, changes) {
        const attachment = state.attachments[attachmentLocalId];
        Object.assign(attachment, changes);
        commit('_computeAttachment', attachment);
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.messageLocalId
     * @param {Object} param1.changes
     * @param {Array} [param1.changes.author_id]
     */
    _updateMessage(
        { commit, state },
        messageLocalId,
        changes,
    ) {
        const {
            author_id: [
                authorId,
                authorDisplayName
            ]=[],
        } = changes;
        const message = state.messages[messageLocalId];
        const prevAuthorLocalId = message.authorLocalId;
        const prevThreadLocalIds = [ ...message.threadLocalIds ];

        // 1. alter message
        Object.assign(message, changes);
        commit('_computeMessage', message);
        if (authorId) {
            commit('insertPartner', {
                display_name: authorDisplayName,
                id: authorId,
            });
        }
        // 2. author: create/update + link
        if (prevAuthorLocalId && prevAuthorLocalId !== message.authorLocalId) {
            commit('_unlinkMessageFromPartner', {
                messageLocalId,
                partnerLocalId: prevAuthorLocalId,
            });
        }
        if (
            message.authorLocalId &&
            prevAuthorLocalId !== message.authorLocalId
        ) {
            commit('_linkMessageToPartner', {
                messageLocalId,
                partnerLocalId: message.authorLocalId,
            });
        }

        // 3. threads: create/update + link
        const oldThreadLocalIds = prevThreadLocalIds.filter(localId =>
            !message.threadLocalIds.includes(localId));
        for (let threadLocalId of oldThreadLocalIds) {
            let thread = state.threads[threadLocalId];
            for (let threadCacheLocalId of thread.cacheLocalIds) {
                commit('_unlinkMessageFromThreadCache', {
                    messageLocalId,
                    threadCacheLocalId,
                });
            }
        }
        const newThreadLocalIds = message.threadLocalIds.filter(localId =>
            !prevThreadLocalIds.includes(localId));
        for (const threadLocalId of newThreadLocalIds) {
            const thread = state.threads[threadLocalId];
            for (const threadCacheLocalId of thread.cacheLocalIds) {
                commit('_linkMessageToThreadCache', {
                    messageLocalId,
                    threadCacheLocalId,
                });
            }
        }
    },
};

return mutations;

});
