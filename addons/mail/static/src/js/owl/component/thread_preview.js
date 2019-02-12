odoo.define('mail.component.ThreadPreview', function (require) {
'use strict';

const mailUtils = require('mail.utils');

const { Component, connect } = owl;

class ThreadPreview extends Component {

    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.template = 'mail.component.ThreadPreview';
        this.id = _.uniqueId('thread_preview');
    }

    //--------------------------------------------------------------------------
    // Getter / Setter
    //--------------------------------------------------------------------------

    /**
     * @return {string}
     */
    get image() {
        if (this.props.thread.direct_partner) {
            return `/web/image/res.partner/${this.props.thread.direct_partner[0].id}/image_small`;
        }
        return `/web/image/mail.channel/${this.props.thread.id}/image_small`;
    }

    /**
     * @return {string}
     */
    get inlineLastMessageBody() {
        if (!this.props.lastMessage) {
            return '';
        }
        return mailUtils.parseAndTransform(this.props.lastMessage.bodyWithLinks, mailUtils.inline);
    }

    /**
     * @return {boolean}
     */
    get isMyselfLastMessageAuthor() {
        return (
            this.props.lastMessageAuthor &&
            this.props.lastMessageAuthor.id === this.env.session.partner_id
        ) || false;
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClick(ev) {
        this.trigger('clicked', {
            threadLocalId: this.props.threadLocalId,
        });
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickMarkAsRead(ev) {
        this.env.store.dispatch('markThreadAsSeen', this.props.threadLocalId);
    }
}

/**
 * Props validation
 */
ThreadPreview.props = {
    lastMessage: { type: Object, /* {mail.store.model.Message} */ optional: true },
    lastMessageAuthor: { type: Object, /* {mail.store.model.Partner} */ optional: true },
    thread: Object, // {mail.store.model.Thread}
    threadLocalId: String,
    threadName: String,
};

return connect(
    ThreadPreview,
    /**
     * @param {Object} state
     * @param {Object} ownProps
     * @param {string} ownProps.threadLocalId
     * @param {Object} getters
     * @return {Object}
     */
    (state, ownProps, getters) => {
        const threadLocalId = ownProps.threadLocalId;
        const threadCache = state.threadCaches[`${threadLocalId}_[]`];
        let lastMessage;
        let lastMessageAuthor;
        if (threadCache) {
            const { length: l, [l-1]: lastMessageLocalId } = threadCache.messageLocalIds;
            lastMessage = state.messages[lastMessageLocalId];
            if (lastMessage) {
                lastMessageAuthor = state.partners[lastMessage.authorLocalId];
            }
        }
        const thread = state.threads[threadLocalId];
        return {
            lastMessage,
            lastMessageAuthor,
            thread,
            threadName: getters.threadName(threadLocalId),
        };
    },
    { deep: false }
);


});
