odoo.define('mail.store.actions', function (require) {
"use strict";

const emojis = require('mail.emojis');
const mailUtils = require('mail.utils');

const config = require('web.config');
const core = require('web.core');
const utils = require('web.utils');

const _t = core._t;

/**
 * @private
 * @param {Object[]} notifications
 * @return {Object[]}
 */
function _filterNotificationsOnUnsubscribe(notifications) {
    const unsubscribedNotif = notifications.find(notif =>
        notif[1].info === 'unsubscribe');
    if (unsubscribedNotif) {
        notifications = notifications.filter(notif =>
            notif[0][1] !== 'mail.channel' ||
            notif[0][2] !== unsubscribedNotif[1].id);
    }
    return notifications;
}

/**
 * @private
 * @param {string} htmlString
 * @return {string}
 */
function _generateEmojisOnHtml(htmlString) {
    for (const emoji of emojis) {
        for (const source of emoji.sources) {
            const escapedSource = String(source).replace(
                /([.*+?=^!:${}()|[\]/\\])/g,
                '\\$1');
            const regexp = new RegExp(
                '(\\s|^)(' + escapedSource + ')(?=\\s|$)',
                'g');
            htmlString = htmlString.replace(regexp, '$1' + emoji.unicode);
        }
    }
    return htmlString;
}

/**
 * @private
 * @param {string} content html content
 * @return {String|undefined} command, if any in the content
 */
function _getCommand(content) {
    const parser = new window.DOMParser();
    const node = parser.parseFromString(content, 'text/html');
    const command = node.querySelector('.o_command');
    return command && command.textContent.substring(1);  // remove first char /
}

/**
 * @private
 * @param {string} content html content
 * @return {integer[]} list of mentioned partner Ids (not duplicate)
 */
function _getMentionedPartnerIds(content) {
    const parser = new window.DOMParser();
    const node = parser.parseFromString(content, 'text/html');
    const mentions = [ ...node.querySelectorAll('.o_mention') ];
    const allPartnerIds = mentions
        .filter(mention =>
            (
                mention.dataset.oeModel === 'res.partner' &&
                !isNaN(Number(mention.dataset.oeId))
            ))
        .map(mention => Number(mention.dataset.oeId));
    return [ ...new Set(allPartnerIds) ];
}

/**
 * @private
 * @param {Object} param0
 * @param {Object} param0.env
 * @param {Object} param0.state
 * @param {Object} param1
 * @param {string} param1.threadLocalId
 * @return {Object}
 */
function _getThreadFetchMessagesKwargs({ env, state }, { threadLocalId }) {
    const thread = state.threads[threadLocalId];
    let kwargs = {
        limit: state.MESSAGE_FETCH_LIMIT,
        context: env.session.user_context
    };
    if (thread.moderation) {
        // thread is a channel
        kwargs.moderated_channel_ids = [thread.id];
    }
    return kwargs;
}

const actions = {

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {string} partnerLocalId
     */
    async checkPartnerIsUser({ commit, env, state }, partnerLocalId) {
        const partner = state.partners[partnerLocalId];
        const userIds = await env.rpc({
            model: 'res.users',
            method: 'search',
            args: [[['partner_id', '=', partner.id]]],
        });
        commit('updatePartner', partnerLocalId, {
            userId: userIds.length ? userIds[0] : null,
        });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.env
     * @param {Object} param1
     * @param {boolean} [param1.autoselect=false]
     * @param {string} [param1.chatWindowOpenMode]
     * @param {string} param1.name
     * @param {integer|undefined} [param1.partnerId=undefined]
     * @param {string|undefined} [param1.public=undefined]
     * @param {string} param1.type
     */
    async createChannel(
        { commit, env, state },
        {
            autoselect=false,
            chatWindowOpenMode,
            name,
            partnerId,
            public: publicStatus,
            type,
        }
    ) {
        const data = await env.rpc({
            model: 'mail.channel',
            method: type === 'chat' ? 'channel_get' : 'channel_create',
            args: type === 'chat' ? [[partnerId]] : [name, publicStatus],
            kwargs: {
                context: {
                    ...env.session.user_content,
                    isMobile: config.device.isMobile
                }
            }
        });
        const threadLocalId = commit('createThread', { ...data });
        if (autoselect) {
            if (state.discuss.isOpen) {
                commit('updateDiscuss', { threadLocalId });
            } else {
                commit('openChatWindow', threadLocalId, {
                    mode: chatWindowOpenMode,
                });
            }
        }
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.env
     * @param {Object} param1
     * @param {integer} param1.resId
     * @param {string} param1.resModel
     */
    async fetchDocumentAttachments(
        { commit, env },
        { resId, resModel }
    ) {
        const attachments = await env.rpc({
            model: 'ir.attachment',
            method: 'search_read',
            domain: [
                ['res_id', '=', resId],
                ['res_model', '=', resModel],
            ],
            fields: ['id', 'name', 'mimetype'],
        });
        for (const attachment of attachments) {
            commit('insertAttachment', {
                res_id: resId,
                res_model: resModel,
                ...attachment,
            });
        }
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {string} threadLocalId
     */
    async fetchSuggestedRecipientsOnThread({ commit, env, state }, threadLocalId) {
        const thread = state.threads[threadLocalId];
        const result = await env.rpc({
            route: '/mail/get_suggested_recipients',
            params: {
                model: thread._model,
                res_ids: [thread.id],
            },
        });
        const suggestedRecipients = result[thread.id].map(recipient => {
            const parsedEmail = recipient[1] && mailUtils.parseEmail(recipient[1]);
            const partnerLocalId = commit('insertPartner', {
                display_name: recipient[1],
                email: parsedEmail[1],
                id: recipient[0],
                name: parsedEmail[0],
            });
            return {
                checked: true,
                partnerLocalId,
                reason: recipient[2],
            };
        });
        commit('updateThread', threadLocalId, { suggestedRecipients });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {function} param0.dispatch
     * @param {Object} param0.env
     * @param {Object} param1
     * @param {function} param1.ready
     */
    async initMessaging(
        { commit, dispatch, env },
        { ready }
    ) {
        await env.session.is_bound;
        const context = {
            isMobile: config.device.isMobile,
            ...env.session.user_context
        };
        const data = await env.rpc({
            route: '/mail/init_messaging',
            params: { context: context }
        });
        commit('initMessaging', {
            currentPartnerData: {
                displayName: env.session.partner_display_name,
                id: env.session.partner_id,
                name: env.session.name,
                userId: env.session.uid,
            },
            ...data
        });
        env.call('bus_service', 'onNotification', null, notifs =>
            dispatch('_handleNotifications', notifs));
        ready();
        env.call('bus_service', 'startPolling');
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {integer} channelId
     * @param {Object} param2
     * @param {boolean} [param2.autoselect=false]
     * @param {string} [param2.chatWindowOpenMode]
     */
    async joinChannel(
        { commit, env, state },
        channelId,
        { autoselect=false, chatWindowOpenMode }={}
    ) {
        const channel = state.threads[`mail.channel_${channelId}`];
        if (channel) {
            return;
        }
        const data = await env.rpc({
            model: 'mail.channel',
            method: 'channel_join_and_get_info',
            args: [[channelId]]
        });
        const threadLocalId = commit('createThread', { ...data });
        if (autoselect) {
            if (state.discuss.isOpen) {
                commit('updateDiscuss', {
                    domain: [],
                    threadLocalId,
                });
            } else {
                commit('openChatWindow', threadLocalId, {
                    mode: chatWindowOpenMode,
                });
            }
        }
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {function} param0.dispatch
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {string} threadLocalId
     * @param {Object} [param2]
     * @param {Array} [param2.searchDomain=[]]
     */
    async loadMessagesOnThread(
        { commit, dispatch, env, state },
        threadLocalId,
        { searchDomain=[] }={}
    ) {
        const thread = state.threads[threadLocalId];
        if (!['mail.box', 'mail.channel'].includes(thread._model)) {
            return dispatch('_loadMessagesOnDocumentThread', threadLocalId);
        }
        const stringifiedDomain = JSON.stringify(searchDomain);
        const threadCacheLocalId = `${threadLocalId}_${stringifiedDomain}`;
        if (!state.threadCaches[threadCacheLocalId]) {
            commit('createThreadCache', {
                stringifiedDomain,
                threadLocalId,
            });
        }
        const threadCache = state.threadCaches[threadCacheLocalId];
        if (threadCache.loaded && threadCache.loading) {
            return;
        }
        let domain = searchDomain.length ? searchDomain : [];
        if (thread._model === 'mail.channel') {
            domain = domain.concat([['channel_ids', 'in', [thread.id]]]);
        } else if (threadLocalId === 'mail.box_inbox') {
            domain = domain.concat([['needaction', '=', true]]);
        } else if (threadLocalId === 'mail.box_starred') {
            domain = domain.concat([['starred', '=', true]]);
        } else if (threadLocalId === 'mail.box_moderation') {
            domain = domain.concat([['need_moderation', '=', true]]);
        }
        commit('updateThreadCache', threadCacheLocalId, { loading: true });
        const messagesData = await env.rpc({
            model: 'mail.message',
            method: 'message_fetch',
            args: [domain],
            kwargs: _getThreadFetchMessagesKwargs(
                { env, state },
                { threadLocalId })
        }, { shadow: true });
        commit('handleThreadLoaded', threadLocalId, {
            messagesData,
            searchDomain,
        });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {string} threadLocalId
     * @param {Object} [param2={}]
     * @param {Array} [param2.searchDomain=[]]
     */
    async loadMoreMessagesOnThread(
        { commit, env, state },
        threadLocalId,
        { searchDomain=[] }={}
    ) {
        const thread = state.threads[threadLocalId];
        const stringifiedDomain = JSON.stringify(searchDomain);
        const threadCacheLocalId = `${threadLocalId}_${stringifiedDomain}`;
        const threadCache = state.threadCaches[threadCacheLocalId];
        let domain = searchDomain.length ? searchDomain : [];
        if (thread._model === 'mail.channel') {
            domain = domain.concat([['channel_ids', 'in', [thread.id]]]);
        } else if (threadLocalId === 'mail.box_inbox') {
            domain = domain.concat([['needaction', '=', true]]);
        } else if (threadLocalId === 'mail.box_starred') {
            domain = domain.concat([['starred', '=', true]]);
        } else if (threadLocalId === 'mail.box_moderation') {
            domain = domain.concat([['need_moderation', '=', true]]);
        }
        if (threadCache.allHistoryLoaded && threadCache.loadingMore) {
            return;
        }
        commit('updateThreadCache', threadCacheLocalId, { loadingMore: true });
        const minMessageId = Math.min(
            ...threadCache.messageLocalIds.map(messageLocalId =>
                state.messages[messageLocalId].id)
        );
        domain = [['id', '<', minMessageId]].concat(domain);
        const messagesData = await env.rpc({
            model: 'mail.message',
            method: 'message_fetch',
            args: [domain],
            kwargs: _getThreadFetchMessagesKwargs(
                { env, state },
                { threadLocalId }
            )
        }, { shadow: true });
        commit('handleThreadLoaded', threadLocalId, {
            messagesData,
            searchDomain,
        });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {string[]} threadLocalIds
     */
    async loadThreadPreviews({ commit, env, state }, threadLocalIds) {
        const threads = threadLocalIds.map(localId => state.threads[localId]);
        const channelIds = threads.reduce((list, thread) => {
            if (thread._model === 'mail.channel') {
                return list.concat(thread.id);
            }
            return list;
        }, []);
        const messagePreviews = await env.rpc({
            model: 'mail.channel',
            method: 'channel_fetch_preview',
            args: [channelIds],
        }, { shadow: true });
        for (const preview of messagePreviews) {
            commit('insertMessage', preview.last_message);
        }
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.env
     * @param {Array[]} domains
     */
    async markAllMessagesAsRead({ env }, domain) {
        await env.rpc({
            model: 'mail.message',
            method: 'mark_all_as_read',
            kwargs: {
                channel_ids: [],
                domain
            }
        });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {string} threadLocalId
     */
    async markThreadAsSeen({ commit, env, state }, threadLocalId) {
        const thread = state.threads[threadLocalId];
        if (thread.message_unread_counter === 0) {
            return;
        }
        if (thread._model === 'mail.channel') {
            const seen_message_id = await env.rpc({
                model: 'mail.channel',
                method: 'channel_seen',
                args: [[thread.id]]
            }, { shadow: true });
            commit('updateThread', threadLocalId, { seen_message_id });
        }
        commit('updateThread', threadLocalId, {
            message_unread_counter: 0,
        });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {string} threadLocalId
     */
    openThread({ commit, state }, threadLocalId) {
        if (state.discuss.isOpen) {
            commit('updateDiscuss', { threadLocalId });
        } else {
            commit('openChatWindow', threadLocalId, {
                mode: 'last_visible',
            });
        }
    },
    /**
     * @param {Object} param0
     * @param {functon} param0.commit
     * @param {function} param0.dispatch
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {string} threadLocalId
     * @param {Object} data
     * @param {string[]} data.attachmentLocalIds
     * @param {*[]} data.canned_response_ids
     * @param {integer[]} data.channel_ids
     * @param {string} data.content
     * @param {string} data.message_type
     * @param {string} data.subject
     * @param {string} [data.subtype='mail.mt_comment']
     * @param {integer|undefined} [data.subtype_id=undefined]
     * @param {...Object} data.kwargs
     * @param {Object} [options]
     * @param {integer|undefined} [options.res_id=undefined]
     * @param {integer|undefined} [options.res_model=undefined]
     */
    async postMessageOnThread(
        { commit, dispatch, env, state },
        threadLocalId,
        {
            attachmentLocalIds,
            canned_response_ids,
            channel_ids=[],
            content,
            context,
            message_type,
            subject,
            subtype='mail.mt_comment',
            subtype_id,
            ...kwargs
        },
        {
            res_id,
            res_model,
        } = {},
    ) {
        const thread = state.threads[threadLocalId];

        if (thread._model === 'mail.box') {
            return dispatch('postMessageOnThread', `${res_model}_${res_id}`, {
                attachmentLocalIds,
                canned_response_ids,
                channel_ids,
                content,
                context,
                message_type,
                subject,
                subtype,
                subtype_id,
                ...kwargs
            });
        }
        // This message will be received from the mail composer as html content
        // subtype but the urls will not be linkified. If the mail composer
        // takes the responsibility to linkify the urls we end up with double
        // linkification a bit everywhere. Ideally we want to keep the content
        // as text internally and only make html enrichment at display time but
        // the current design makes this quite hard to do.
        let body = mailUtils.parseAndTransform(
            content.trim(),
            mailUtils.addLink
        );
        body = _generateEmojisOnHtml(body);
        let postData = {
            attachment_ids: attachmentLocalIds.map(localId =>
                    state.attachments[localId].id),
            body,
            partner_ids: _getMentionedPartnerIds(body),
        };
        if (thread._model === 'mail.channel') {
            const command = _getCommand(body);
            Object.assign(postData, {
                command,
                message_type: 'comment',
                subtype: 'mail.mt_comment'
            });
            await env.rpc({
                model: 'mail.channel',
                method: command ? 'execute_command' : 'message_post',
                args: [thread.id],
                kwargs: postData
            });
        } else {
            Object.assign(postData, {
                channel_ids: channel_ids.map(id => [4, id, false]),
                canned_response_ids
            });
            if (subject) {
                postData.subject = subject;
            }
            Object.assign(postData, {
                context,
                message_type,
                subtype,
                subtype_id
            });
            const id = await env.rpc({
                model: thread._model,
                method: 'message_post',
                args: [thread.id],
                kwargs: postData
            });
            const [msgData] = await env.rpc({
                model: 'mail.message',
                method: 'message_format',
                args: [[id]]
            });
            commit('createMessage', {
                ...msgData,
                model: thread._model,
                res_id: thread.id
            });
        }
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {string} threadLocalId
     * @param {string} newName
     */
    async renameThread({ commit, env, state }, threadLocalId, newName) {
        const thread = state.threads[threadLocalId];
        if (thread.channel_type === 'chat') {
            await env.rpc({
                model: 'mail.channel',
                method: 'channel_set_custom_name',
                args: [thread.id],
                kwargs: {
                    name: newName,
                }
            });
        }
        commit('updateThread', threadLocalId, {
            custom_channel_name: newName,
        });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {function} param1.callback
     * @param {string} param1.keyword
     * @param {integer} [param1.limit=10]
     */
    async searchPartners(
        { commit, env, state },
        { callback, keyword, limit=10 }
    ) {
        // prefetched partners
        let partners = [];
        const searchRegexp = new RegExp(
            _.str.escapeRegExp(utils.unaccent(keyword)),
            'i'
        );
        const currentPartner = state.partners[state.currentPartnerLocalId];
        for (const partner of Object.values(state.partners)) {
            if (partners.length < limit) {
                if (
                    partner.id !== currentPartner.id &&
                    searchRegexp.test(partner.name)
                ) {
                    partners.push(partner);
                }
            }
        }
        if (!partners.length) {
            const partnersData = await env.rpc(
                {
                    model: 'res.partner',
                    method: 'im_search',
                    args: [keyword, limit]
                },
                { shadow: true }
            );
            for (const data of partnersData) {
                const partnerLocalId = commit('insertPartner', data);
                partners.push(state.partners[partnerLocalId]);
            }
        }
        callback(partners);
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {string} messageLocalId
     */
    async toggleStarMessage({ env, state }, messageLocalId) {
        return env.rpc({
            model: 'mail.message',
            method: 'toggle_message_starred',
            args: [[state.messages[messageLocalId].id]]
        });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {string} attachmentLocalId
     */
    async unlinkAttachment({ commit, env, state }, attachmentLocalId) {
        const attachment = state.attachments[attachmentLocalId];
        await env.rpc({
            model: 'ir.attachment',
            method: 'unlink',
            args: [attachment.id],
        }, { shadow: true });
        commit('deleteAttachment', attachmentLocalId);
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.env
     */
    async unstarAllMessages({ env }) {
        return env.rpc({
            model: 'mail.message',
            method: 'unstar_all',
        });
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {string} channelLocalId
     */
    async unsubscribeFromChannel({ env, state }, channelLocalId) {
        const channel = state.threads[channelLocalId];
        if (channel.channel_type === 'channel') {
            return env.rpc({
                model: 'mail.channel',
                method: 'action_unfollow',
                args: [[channel.id]]
            });
        }
        return env.rpc({
            model: 'mail.channel',
            method: 'channel_pin',
            args: [channel.uuid, false]
        });
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.dispatch
     * @param {Object} param1
     * @param {integer} param1.channelId
     * @param {string|undefined} [param1.info=undefined]
     * @param {...Object} param1.kwargs
     */
    async _handleNotificationChannel(
        { dispatch },
        { channelId, info, ...kwargs }
    ) {
        switch (info) {
            case 'channel_fetched':
                return; // disabled seen notification feature
            case 'channel_seen':
                return dispatch('_handleNotificationChannelSeen', { channelId, ...kwargs });
            case 'typing_status':
                return; // disabled typing status notification feature
            default:
                return dispatch('_handleNotificationChannelMessage', { channelId, info, ...kwargs });
        }
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {function} param0.dispatch
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {Array|undefined} [param1.author_id=undefined]
     * @param {integer|undefined} [param1.author_id[0]=undefined]
     * @param {integer} param1.channelId
     * @param {integer[]} param1.channel_ids
     * @param {...Object} param1.kwargs
     */
    async _handleNotificationChannelMessage(
        { commit, dispatch, state },
        {
            author_id, author_id: [authorPartnerId]=[],
            channelId,
            channel_ids,
            ...kwargs
        }
    ) {
        if (channel_ids.length === 1) {
            await dispatch('joinChannel', channel_ids[0]);
        }
        commit('createMessage', {
            author_id,
            channel_ids,
            ...kwargs
        });
        const currentPartner = state.partners[state.currentPartnerLocalId];
        if (authorPartnerId === currentPartner.id) {
            return;
        }
        const threadLocalId = `mail.channel_${channelId}`;
        const thread = state.threads[threadLocalId];
        commit('updateThread', threadLocalId, {
            message_unread_counter: thread.message_unread_counter + 1,
        });
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {integer} param1.channelId
     * @param {integer} param1.last_message_id
     * @param {integer} param1.partner_id
     */
    async _handleNotificationChannelSeen(
        { commit, state },
        { channelId, last_message_id, partner_id }
    ) {

        const currentPartner = state.partners[state.currentPartnerLocalId];
        if (currentPartner.id !== partner_id) {
            return;
        }
        commit('updateThread', `mail.channel_${channelId}`, {
            seen_message_id: last_message_id,
            message_unread_counter: 0,
        });
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {function} param0.dispatch
     * @param {Object} param1
     * @param {string|undefined} [param1.info=undefined]
     * @param {string|undefined} [param1.type=undefined]
     * @param {...Object} param1.kwargs
     */
    async _handleNotificationPartner(
        { commit, dispatch },
        { info, type, ...kwargs }
    ) {
        if (type === 'activity_updated') {
            return; // disabled
        } else if (type === 'author') {
            return; // disabled
        } else if (type === 'deletion') {
            return; // disabled
        } else if (type === 'mail_failure') {
            return dispatch('_handleNotificationPartnerMailFailure', { ...kwargs });
        } else if (type === 'mark_as_read') {
            return commit('handleNotificationPartnerMarkAsRead', { ...kwargs });
        } else if (type === 'moderator') {
            return; // disabled
        } else if (type === 'toggle_star') {
            return commit('handleNotificationPartnerToggleStar', { ...kwargs });
        } else if (info === 'transient_message') {
            return commit('handleNotificationPartnerTransientMessage', { info, type, ...kwargs });
        } else if (info === 'unsubscribe') {
            return dispatch('_handleNotificationPartnerUnsubscribe', { ...kwargs });
        } else if (type === 'user_connection') {
            return dispatch('_handleNotificationPartnerUserConnection', { ...kwargs });
        } else {
            return dispatch('_handleNotificationPartnerChannel', { ...kwargs });
        }
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.channel_type
     * @param {integer} param1.id
     * @param {string|undefined} [param1.info=undefined]
     * @param {boolean} [param1.is_minimized=false]
     * @param {string} param1.name
     * @param {string} param1.state
     * @param {...Object} param1.kwargs
     */
    _handleNotificationPartnerChannel(
        { commit, env, state },
        {
            channel_type,
            id,
            info,
            is_minimized=false,
            name,
            state: channelState,
            ...kwargs
        }
    ) {
        if (channel_type !== 'channel' || channelState !== 'open') {
            return;
        }
        if (!is_minimized && info !== 'creation') {
            env.do_notify(
                _t("Invitation"),
                _t(`You have been invited to: ${name}`)
            );
        }
        if (!state.threads[`mail.channel_${id}`]) {
            commit('createThread', {
                channel_type,
                id,
                info,
                is_minimized,
                name,
                ...kwargs
            });
        }
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param1
     * @param {Array} param1.elements
     */
    _handleNotificationPartnerMailFailure({ commit }, { elements }) {
        for (const data of elements) {
            // todo
        }
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {integer} param1.id
     */
    _handleNotificationPartnerUnsubscribe({ commit, env, state }, { id }) {
        const threadLocalId = `mail.channel_${id}`;
        const thread = state.threads[threadLocalId];
        if (!thread) {
            return;
        }
        let message;
        if (thread.directPartner) {
            const directPartner = this.state.partners[thread.directPartner];
            message = _t(`You unpinned your conversation with <b>${directPartner.name}</b>.`);
        } else {
            message = _t(`You unsubscribed from <b>${thread.name}</b>.`);
        }
        env.do_notify(_t("Unsubscribed"), message);
        commit('unpinThread', threadLocalId);
    },
    /**
     * @private
     * @param {Object} param0
     * @param {Object} param0.env
     * @param {Object} param1
     * @param {integer} param1.partner_id
     * @param {string} param1.title
     * @param {string} param1.message
     */
    _handleNotificationPartnerUserConnection({ env }, { partner_id, title, message }) {
        env.call('bus_service', 'sendNotification', title, message);
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {function} param0.dispatch
     * @param {Object[]} notifs
     */
    async _handleNotifications({ commit, dispatch }, notifs) {
        notifs = _filterNotificationsOnUnsubscribe(notifs);
        const proms = notifs.map(notif => {
            const model = notif[0][1];
            switch (model) {
                case 'ir.needaction':
                    return commit('handleNotificationNeedaction', { ...notif[1] });
                case 'mail.channel':
                    return dispatch('_handleNotificationChannel', {
                        channelId: notif[0][2],
                        ...notif[1]
                    });
                case 'res.partner':
                    return dispatch('_handleNotificationPartner', { ...notif[1] });
                default:
                    console.warn(`[store ${this.name}] Unhandled notification "${model}"`);
                    return;
            }
        });
        return Promise.all(proms);
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {function} param0.dispatch
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {string} threadLocalId
     */
    async _loadMessagesOnDocumentThread({ commit, dispatch, env, state }, threadLocalId) {
        const thread = state.threads[threadLocalId];
        const message_ids = thread._messageIds;

        // TODO: this is for document_thread inside chat window
        // else {
        //     const [{ message_ids }] = await env.rpc({
        //         model: thread._model,
        //         method: 'read',
        //         args: [[thread.id], ['message_ids']]
        //     });
        // }
        const threadCacheLocalId = `${threadLocalId}_[]`;
        if (!state.threadCaches[threadCacheLocalId]) {
            commit('createThreadCache', {
                stringifiedDomain: '[]',
                threadLocalId,
            });
        }
        const threadCache = state.threadCaches[threadCacheLocalId];
        const loadedMessageIds = threadCache.messageLocalIds
            .filter(localId => message_ids.includes(state.messages[localId].id))
            .map(localId => state.messages[localId].id);
        const shouldFetch = message_ids
            .slice(0, state.MESSAGE_FETCH_LIMIT)
            .filter(messageId => !loadedMessageIds.includes(messageId))
            .length > 0;
        if (!shouldFetch) {
            return;
        }
        const idsToLoad = message_ids
            .filter(messageId => !loadedMessageIds.includes(messageId))
            .slice(0, state.MESSAGE_FETCH_LIMIT);
        commit('updateThreadCache', threadCacheLocalId, { loading: true });
        const messagesData = await env.rpc({
            model: 'mail.message',
            method: 'message_format',
            args: [idsToLoad],
            context: env.session.user_context
        });
        commit('handleThreadLoaded', threadLocalId, {
            messagesData,
        });
        // await dispatch('markMessagesAsRead', messageLocalIds);
    },
    /**
     * @private
     * @param {Object} param0
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string[]} param1.messageLocalIds
     */
    async markMessagesAsRead({ env, state }, messageLocalIds) {
        const currentPartner = state.partners[state.currentPartnerLocalId];
        const ids = messageLocalIds
            .filter(localId => {
                const message = state.messages[localId];
                // If too many messages, not all are fetched,
                // and some might not be found
                return !message || message.needaction_partner_ids.includes(currentPartner.id);
            })
            .map(localId => state.messages[localId].id);
        if (!ids.length) {
            return;
        }
        await env.rpc({
            model: 'mail.message',
            method: 'set_message_done',
            args: [ids]
        });
    },
};

return actions;

});
