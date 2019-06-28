odoo.define('mail.component.MessageList', function (require) {
'use strict';

const Message = require('mail.component.Message');

const { Component, connect } = owl;

class MessageList extends Component {
    constructor(...args) {
        super(...args);
        this.components = {
            Message,
        };
        this.template = 'mail.component.MessageList';
        this._autoLoadOnScroll = true;
        this._onScroll = _.throttle(this._onScroll.bind(this), 100);
        this._renderedThreadCacheLocalId = null;
    }

    mounted() {
        if (this.props.scrollTop !== undefined) {
            this.el.scrollTop = this.props.scrollTop;
        } else {
            this.scrollToLastMessage();
        }
        this._renderedThreadCacheLocalId = this.props.threadCacheLocalId;
    }

    /**
     * @return {Object} snapshot object
     */
    willPatch() {
        const {
            length: l,
            0: firstMessageLocalId,
            [l-1]: lastMessageLocalId,
        } = this.props.messageLocalIds;

        const firstMessageRef = this.firstMessageRef;
        const lastMessageRef = this.lastMessageRef;
        const isPatchedWithNewThreadCache =
            this._renderedThreadCacheLocalId !== this.props.threadCacheLocalId;

        return {
            isLastMessageVisible:
                lastMessageRef &&
                lastMessageRef.bottomVisible
            ,
            isPatchedWithNewMessages:
                !isPatchedWithNewThreadCache &&
                (
                    (
                        // FIXME:
                        // had messages, has different last message
                        // it assumes it comes from new message, but what if
                        // last message was deleted?
                        // this is important for moderation, in case of message
                        // deletion
                        lastMessageRef &&
                        lastMessageLocalId &&
                        lastMessageRef.props.messageLocalId !== lastMessageLocalId
                    ) ||
                    (
                        // had no messages, now has a last message
                        !lastMessageRef &&
                        lastMessageLocalId
                    )
                ),
            isPatchedWithLoadMoreMessages:
                !isPatchedWithNewThreadCache &&
                firstMessageRef.props.messageLocalId !== firstMessageLocalId,
            isPatchedWithNewThreadCache,
            scrollHeight: this.el.scrollHeight,
            scrollTop: this.el.scrollTop,
        };
    }

    /**
     * @param {Object} snapshot
     * @param {boolean} snapshot.isLastMessageVisible
     * @param {boolean} snapshot.isPatchedWithNewMessages
     * @param {boolean} snapshot.isPatchedWithLoadMoreMessages
     * @param {boolean} snapshot.isPatchedWithNewThreadCache
     * @param {integer} snapshot.scrollHeight
     * @param {integer} snapshot.scrollTop
     */
    patched(snapshot) {
        if (snapshot.isPatchedWithLoadMoreMessages) {
            this.el.scrollTop =
                this.el.scrollHeight -
                snapshot.scrollHeight +
                snapshot.scrollTop;
        }
        if (
            snapshot.isPatchedWithNewThreadCache ||
            (
                snapshot.isPatchedWithNewMessages &&
                snapshot.isLastMessageVisible
            )
        ) {
            this._autoLoadOnScroll = false;
            this.lastMessageRef
                .scrollToVisibleBottom()
                .then(() => {
                    this._autoLoadOnScroll = true;
                    this._onScroll();
                });
        }
        this._renderedThreadCacheLocalId = this.props.threadCacheLocalId;
    }

    //--------------------------------------------------------------------------
    // Getters / Setters
    //--------------------------------------------------------------------------

    /**
     * @return {mail.component.Message}
     */
    get firstMessageRef() {
        return this.messageRefs[0];
    }

    /**
     * @return {boolean}
     */
    get hasMessages() {
        return this.props.messages.length > 0;
    }

    /**
     * @return {mail.component.Message}
     */
    get lastMessageRef() {
        let { length: l, [l-1]: lastMessageRef } = this.messageRefs;
        return lastMessageRef;
    }

    /**
     * @return {boolean}
     */
    get loadingMore() {
        return this.props.threadCache.loadingMore || false;
    }

    /**
     * @return {boolean}
     */
    get loadMoreVisible() {
        const loadMore = this.refs.loadMore;
        if (!loadMore) {
            return false;
        }
        const loadMoreRect = loadMore.getBoundingClientRect();
        const elRect = this.el.getBoundingClientRect();
        // intersection with 10px offset
        return (
            loadMoreRect.top < elRect.bottom + 10 &&
            elRect.top < loadMoreRect.bottom + 10
        );
    }

    /**
     * @return {mail.component.Message[]}
     */
    get messageRefs() {
        return Object.entries(this.refs)
            .filter(([refId, ref]) => refId.indexOf('mail.message') !== -1)
            .map(([refId, ref]) => ref)
            .sort((ref1, ref2) => (ref1.props.message.id < ref2.props.message.id ? -1 : 1));
    }
    /**
     * @return {mail.model.Message[]}
     */
    get messages() {
        if (this.props.order === 'desc') {
            return [ ...this.props.messages ].reverse();
        }
        return this.props.messages;
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @param {mail.store.model.Message} message
     * @return {string}
     */
    getDateDay(message) {
        var date = message.dateMoment.format('YYYY-MM-DD');
        if (date === moment().format('YYYY-MM-DD')) {
            return this.env._t("Today");
        } else if (
            date === moment()
                .subtract(1, 'days')
                .format('YYYY-MM-DD')
        ) {
            return this.env._t("Yesterday");
        }
        return message.dateMoment.format('LL');
    }

    /**
     * @return {integer}
     */
    getScrollTop() {
        return this.el.scrollTop;
    }

    /**
     * @return {Promise}
     */
    scrollToLastMessage() {
        if (!this.hasMessages) {
            return Promise.resolve();
        }
        this._autoLoadOnScroll = false;
        return this.lastMessageRef.scrollToVisibleBottom().then(() => {
            this._autoLoadOnScroll = true;
        });
    }

    /**
     * @param {integer} value
     */
    setScrollTop(value) {
        this.el.scrollTop = value;
    }

    /**
     * @param {mail.store.model.Message} prevMessage
     * @param {mail.store.model.Message} message
     * @return {boolean}
     */
    shouldSquash(prevMessage, message) {
        if (!this.props.squashCloseMessages) {
            return false;
        }
        const prevDate = prevMessage.dateMoment;
        const date = message.dateMoment;
        if (Math.abs(date.diff(prevDate)) > 60000) {
            // more than 1 min. elasped
            return false;
        }
        if (prevMessage.message_type !== 'comment' || message.message_type !== 'comment') {
            return false;
        }
        if (prevMessage.authorLocalId !== message.authorLocalId) {
            // from a different author
            return false;
        }
        if (prevMessage.originThreadLocalId !== message.originThreadLocalId) {
            return false;
        }
        const prevOriginThread = this.env.store.state.threads[prevMessage.originThreadLocalId];
        const originThread = this.env.store.state.threads[message.originThreadLocalId];
        if (
            prevOriginThread &&
            originThread &&
            prevOriginThread._model === originThread._model &&
            originThread._model !== 'mail.channel' &&
            prevOriginThread.id !== originThread.model
        ) {
            // messages linked to different document thread
            return false;
        }
        return true;
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _loadMore() {
        this.env.store.dispatch('loadMoreMessagesOnThread', this.props.threadLocalId, {
            searchDomain: this.props.domain,
        });
    }

    /**
     * @private
     */
    _markAsSeen() {
        this.env.store.dispatch('markThreadAsSeen', this.props.threadLocalId);
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickLoadMore(ev) {
        ev.preventDefault();
        this._loadMore();
    }

    /**
     * @private
     * @param {ScrollEvent} ev
     */
    _onScroll(ev) {
        if (!this.el) {
            // could be unmounted in the meantime (due to throttled behavior)
            return;
        }
        if (!this._autoLoadOnScroll) {
            return;
        }
        if (this.loadMoreVisible) {
            this._loadMore();
        }
        if (
            !this.props.domain.length &&
            this.lastMessageRef.partiallyVisible
        ) {
            this._markAsSeen();
        }
    }
}

/**
 * Props validationn
 */
MessageList.props = {
    displayReplyIcons: Boolean,
    domain: Array,
    messageLocalIds: { type: Array, element: String },
    messages: { type: Array, element: Object /* {mail.store.model.Message} */ },
    order: String, // ['asc', 'desc']
    redirectAuthor: Boolean,
    scrollTop: { type: Number, optional: true },
    squashCloseMessages: Boolean,
    thread: Object, // {mail.store.model.Thread}
    threadCache: Object, // {mail.store.model.ThreadCache}
    threadCacheLocalId: String,
    threadLocalId: String,
};

MessageList.defaultProps = {
    domain: [],
    order: 'asc',
    redirectAuthor: false,
    squashCloseMessages: false,
};

return connect(
    MessageList,
    /**
     * @param {Object} state
     * @param {Object} ownProps
     * @param {string} ownProps.threadCacheLocalId
     * @param {string} ownProps.threadLocalId
     * @return {Object}
     */
    (state, ownProps) => {
        const threadCache = state.threadCaches[ownProps.threadCacheLocalId];
        return {
            messageLocalIds: threadCache.messageLocalIds,
            messages: threadCache.messageLocalIds.map(localId => state.messages[localId]),
            thread: state.threads[ownProps.threadLocalId],
            threadCache,
        };
    },
    { deep: false }
);

});
