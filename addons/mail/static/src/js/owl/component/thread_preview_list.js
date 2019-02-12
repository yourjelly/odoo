odoo.define('mail.component.ThreadPreviewList', function (require) {
'use strict';

const ThreadPreview = require('mail.component.ThreadPreview');

const { Component, connect } = owl;

class ThreadPreviewList extends Component {

    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.components = { ThreadPreview };
        this.template = 'mail.component.ThreadPreviewList';
    }

    mounted() {
        this._loadPreviews();
    }

    //--------------------------------------------------------------------------
    // Getters / Setters
    //--------------------------------------------------------------------------

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    async _loadPreviews() {
        this.env.store.dispatch('loadThreadPreviews', this.props.threadLocalIds);
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {CustomEvent} ev
     * @param {Object} ev.detail
     * @param {string} ev.detail.threadLocalId
     */
    _onClickedPreview(ev) {
        this.trigger('select-thread', {
            threadLocalId: ev.detail.threadLocalId,
        });
    }
}

/**
 * Props validation
 */
ThreadPreviewList.props = {
    filter: String, // ['all', 'mailbox', 'channel', 'chat']
    threadLocalIds: { type: Array, element: String },
};

ThreadPreviewList.defaultProps = {
    filter: 'all',
};

return connect(
    ThreadPreviewList,
    /**
     * @param {Object} state
     * @param {Object} ownProps
     * @param {string} ownProps.filter
     * @param {Object} getters
     * @return {Object}
     */
    (state, ownProps, getters) => {
        let threadLocalIds;
        if (ownProps.filter === 'mailbox') {
            threadLocalIds = getters.mailboxList().map(mailbox => mailbox.localId);
        } else if (ownProps.filter === 'channel') {
            threadLocalIds = getters.channelList().map(channel => channel.localId);
        } else if (ownProps.filter === 'chat') {
            threadLocalIds = getters.chatList().map(chat => chat.localId);
        } else {
            // "All" filter is for channels and chats
            threadLocalIds = getters.mailChannelList().map(mailChannel => mailChannel.localId);
        }
        return { threadLocalIds };
    },
    { deep: false }
);

});
