odoo.define('mail.component.Thread', function (require) {
'use strict';

const Composer = require('mail.component.Composer');
const MessageList = require('mail.component.MessageList');

const { Component, connect } = owl;

class Thread extends Component {

    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.components = { Composer, MessageList };
        this.template = 'mail.component.Thread';
        this._renderedThreadCacheLocalId = null;
    }

    mounted() {
        if (!this.loaded) {
            this._loadThread();
        }
        this._renderedThreadCacheLocalId = this.props.threadCacheLocalId;
        this.trigger('rendered');
    }

    patched() {
        if (!this.loading && !this.loaded) {
            this._loadThread();
        }
        if (this.loaded && this.hasMessages) {
            if (this.props.scrollTop !== undefined) {
                this.refs.messageList.setScrollTop(this.props.scrollTop);
            } else if (this._renderedThreadCacheLId !== this.props.threadCacheLId) {
                this.refs.messageList.scrollToLastMessage();
            }
        }
        this._renderedThreadCacheLocalId = this.props.threadCacheLocalId;
        this.trigger('rendered');
    }

    //--------------------------------------------------------------------------
    // Getters / Setters
    //--------------------------------------------------------------------------

    /**
     * @return {boolean}
     */
    get hasMessages() {
        return (
            this.props.threadCache &&
            this.props.threadCache.messageLocalIds.length > 0
        ) || false;
    }

    /**
     * @return {boolean}
     */
    get loaded() {
        return (
            this.props.threadCache &&
            this.props.threadCache.loaded
        ) || false;
    }

    /**
     * @return {boolean}
     */
    get loading() {
        return (
            this.props.threadCache &&
            this.props.threadCache.loading
        ) || false;
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    focus() {
        if (!this.refs.composer) {
            return;
        }
        this.refs.composer.focus();
    }

    focusout() {
        if (!this.refs.composer) {
            return;
        }
        this.refs.composer.focusout();
    }

    /**
     * @return {integer}
     */
    getScrollTop() {
        return this.refs.messageList.getScrollTop();
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _loadThread() {
        this.env.store.dispatch('loadMessagesOnThread', this.props.threadLocalId, {
            searchDomain: this.props.domain,
        });
    }
}

/**
 * Props validation
 */
Thread.props = {
    composerAttachmentEditable: { type: Boolean, optional: true },
    composerAttachmentLayout: { type: String, optional: true },
    composerAttachmentLayoutCardLabel: { type: Boolean, optional: true },
    composerAvatar: { type: Boolean, optional: true },
    composerSendButton: { type: Boolean, optional: true },
    displayReplyIcons: { type: Boolean, optional: true },
    domain: Array,
    order: String, // ['asc', 'desc']
    redirectAuthor: Boolean,
    scrollTop: { type: Number, optional: true },
    showComposer: Boolean,
    squashCloseMessages: Boolean,
    threadCacheLocalId: String,
    threadCache: { type: Object, /* {mail.store.model.ThreadCache} */ optional: true },
    threadLocalId: String,
};

Thread.defaultProps = {
    domain: [],
    order: 'asc',
    redirectAuthor: false,
    showComposer: false,
    squashCloseMessages: false,
};

return connect(
    Thread,
    /**
     * @param {Object} state
     * @param {Object} ownProps
     * @param {Array} [ownProps.domain=[]]
     * @param {string} ownProps.threadLocalId
     * @return {Object}
     */
    (state, ownProps) => {
        const threadCacheLocalId = `${ownProps.threadLocalId}_${JSON.stringify(ownProps.domain || [])}`;
        const threadCache = state.threadCaches[threadCacheLocalId];
        return {
            threadCache,
            threadCacheLocalId,
        };
    },
    { deep: false }
);

});
