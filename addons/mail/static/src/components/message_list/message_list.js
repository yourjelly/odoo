/** @odoo-module **/

import { registerMessagingComponent } from '@mail/utils/messaging_component';
import { useComponentToModel } from '@mail/component_hooks/use_component_to_model/use_component_to_model';
import { useRenderedValues } from '@mail/component_hooks/use_rendered_values/use_rendered_values';
import { useUpdate } from '@mail/component_hooks/use_update/use_update';
import { useRefToModel } from '@mail/component_hooks/use_ref_to_model/use_ref_to_model';

const { Component, onWillPatch, useRef } = owl;

export class MessageList extends Component {

    /**
     * @override
     */
    setup() {
        super.setup();
        useComponentToModel({ fieldName: 'component', modelName: 'MessageListView' });
        useRefToModel({ fieldName: 'scrollRef', modelName: 'MessageListView', refName: 'root' });
        /**
         * States whether there was at least one programmatic scroll since the
         * last scroll event was handled (which is particularly async due to
         * throttled behavior).
         * Useful to avoid loading more messages or to incorrectly disabling the
         * auto-scroll feature when the scroll was not made by the user.
         */
        this._isLastScrollProgrammatic = false;
        /**
         * Reference of the "load more" item. Useful to trigger load more
         * on scroll when it becomes visible.
         */
        this._loadMoreRef = useRef('loadMore');
        /**
         * Snapshot computed during willPatch, which is used by patched.
         */
        this._willPatchSnapshot = undefined;
        this._onScrollThrottled = _.throttle(this._onScrollThrottled.bind(this), 100);
        /**
         * State used by the component at the time of the render. Useful to
         * properly handle async code.
         */
        this._lastRenderedValues = useRenderedValues(() => {
            const messageListView = this.messageListView;
            const threadView = messageListView && messageListView.threadViewOwner;
            const thread = threadView && threadView.thread;
            const threadCache = threadView && threadView.threadCache;
            return {
                componentHintList: threadView ? [...threadView.componentHintList] : [],
                hasAutoScrollOnMessageReceived: threadView && threadView.hasAutoScrollOnMessageReceived,
                hasScrollAdjust: this.props.hasScrollAdjust,
                order: threadView && threadView.order,
                orderedMessages: threadCache ? [...threadCache.orderedMessages] : [],
                thread,
                threadCache,
                threadCacheInitialScrollHeight: threadView && threadView.threadCacheInitialScrollHeight,
                threadCacheInitialScrollPosition: threadView && threadView.threadCacheInitialScrollPosition,
                threadView,
                threadViewer: threadView && threadView.threadViewer,
            };
        });
        // useUpdate must be defined after useRenderedValues, indeed they both
        // use onMounted/onPatched, and the calls from useRenderedValues must
        // happen first to save the values before useUpdate accesses them.
        useUpdate({ func: () => this._update() });
        onWillPatch(() => this._willPatch());
    }

    _willPatch() {
        if (!this.messageListView) {
            return;
        }
        this._willPatchSnapshot = {
            scrollHeight: this.messageListView.scrollableElementRef.el.scrollHeight,
            scrollTop: this.messageListView.scrollableElementRef.el.scrollTop,
        };
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Update the scroll position of the message list.
     * This is not done in patched/mounted hooks because scroll position is
     * dependent on UI globally. To illustrate, imagine following UI:
     *
     * +----------+ < viewport top = scrollable top
     * | message  |
     * |   list   |
     * |          |
     * +----------+ < scrolltop = viewport bottom = scrollable bottom
     *
     * Now if a composer is mounted just below the message list, it is shrinked
     * and scrolltop is altered as a result:
     *
     * +----------+ < viewport top = scrollable top
     * | message  |
     * |   list   | < scrolltop = viewport bottom  <-+
     * |          |                                  |-- dist = composer height
     * +----------+ < scrollable bottom            <-+
     * +----------+
     * | composer |
     * +----------+
     *
     * Because of this, the scroll position must be changed when whole UI
     * is rendered. To make this simpler, this is done when <ThreadView/>
     * component is patched. This is acceptable when <ThreadView/> has a
     * fixed height, which is the case for the moment. task-2358066
     */
    adjustFromComponentHints() {
        const { componentHintList, threadView } = this._lastRenderedValues();
        for (const hint of componentHintList) {
            switch (hint.type) {
                case 'change-of-thread-cache':
                case 'member-list-hidden':
                    // thread just became visible, the goal is to restore its
                    // saved position if it exists or scroll to the end
                    this._adjustScrollFromModel();
                    break;
                case 'message-received':
                case 'messages-loaded':
                case 'new-messages-loaded':
                    // messages have been added at the end, either scroll to the
                    // end or keep the current position
                    this._adjustScrollForExtraMessagesAtTheEnd();
                    break;
                case 'more-messages-loaded':
                    // messages have been added at the start, keep the current
                    // position
                    this._adjustScrollForExtraMessagesAtTheStart();
                    break;
            }
            if (threadView && threadView.exists()) {
                threadView.markComponentHintProcessed(hint);
            }
        }
        this._willPatchSnapshot = undefined;
    }

    /**
     * @param {integer} value
     */
    setScrollTop(value) {
        if (this.messageListView.scrollableElementRef.el.scrollTop === value) {
            return;
        }
        this._isLastScrollProgrammatic = true;
        this.messageListView.scrollableElementRef.el.scrollTop = value;
    }

    /**
     * @returns {MessageListView}
     */
    get messageListView() {
        return this.messaging && this.messaging.models['MessageListView'].get(this.props.localId);
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _adjustScrollForExtraMessagesAtTheEnd() {
        const {
            hasAutoScrollOnMessageReceived,
            hasScrollAdjust,
            order,
        } = this._lastRenderedValues();
        if (!this.messageListView.scrollableElementRef.el || !hasScrollAdjust) {
            return;
        }
        if (!hasAutoScrollOnMessageReceived) {
            if (order === 'desc' && this._willPatchSnapshot) {
                const { scrollHeight, scrollTop } = this._willPatchSnapshot;
                this.setScrollTop(this.messageListView.scrollableElementRef.el.scrollHeight - scrollHeight + scrollTop);
            }
            return;
        }
        this._scrollToEnd();
    }

    /**
     * @private
     */
    _adjustScrollForExtraMessagesAtTheStart() {
        const {
            hasScrollAdjust,
            order,
        } = this._lastRenderedValues();
        if (
            !this.messageListView.scrollableElementRef.el ||
            !hasScrollAdjust ||
            !this._willPatchSnapshot ||
            order === 'desc'
        ) {
            return;
        }
        const { scrollHeight, scrollTop } = this._willPatchSnapshot;
        this.setScrollTop(this.messageListView.scrollableElementRef.el.scrollHeight - scrollHeight + scrollTop);
    }

    /**
     * @private
     */
    _adjustScrollFromModel() {
        const {
            hasScrollAdjust,
            threadCacheInitialScrollHeight,
            threadCacheInitialScrollPosition,
        } = this._lastRenderedValues();
        if (!this.messageListView.scrollableElementRef.el || !hasScrollAdjust) {
            return;
        }
        if (
            threadCacheInitialScrollPosition !== undefined &&
            this.messageListView.scrollableElementRef.el.scrollHeight === threadCacheInitialScrollHeight
        ) {
            this.setScrollTop(threadCacheInitialScrollPosition);
            return;
        }
        this._scrollToEnd();
        return;
    }

    /**
     * @private
     */
    _checkMostRecentMessageIsVisible() {
        const { threadView } = this._lastRenderedValues();
        if (!threadView || !threadView.exists()) {
            return;
        }
        const { lastMessageView } = this.messageListView.threadViewOwner;
        if (lastMessageView && lastMessageView.component && lastMessageView.component.isPartiallyVisible()) {
            threadView.handleVisibleMessage(lastMessageView.message);
        }
    }

    /**
     * @private
     * @returns {boolean}
     */
    _isLoadMoreVisible() {
        const loadMore = this._loadMoreRef.el;
        if (!loadMore) {
            return false;
        }
        const loadMoreRect = loadMore.getBoundingClientRect();
        const elRect = this.messageListView.scrollableElementRef.el.getBoundingClientRect();
        const isInvisible = loadMoreRect.top > elRect.bottom || loadMoreRect.bottom < elRect.top;
        return !isInvisible;
    }

    /**
     * @private
     */
    _loadMore() {
        const { threadCache } = this._lastRenderedValues();
        if (!threadCache || !threadCache.exists()) {
            return;
        }
        threadCache.loadMoreMessages();
    }

    /**
     * Scrolls to the end of the list.
     *
     * @private
     */
    _scrollToEnd() {
        const { order } = this._lastRenderedValues();
        this.setScrollTop(order === 'asc' ? this.messageListView.scrollableElementRef.el.scrollHeight - this.messageListView.scrollableElementRef.el.clientHeight : 0);
    }

    /**
     * @private
     */
    _update() {
        this.adjustFromComponentHints();
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
     */
    _onClickRetryLoadMoreMessages() {
        if (!this.messageListView) {
            return;
        }
        if (!this.messageListView.threadViewOwner) {
            return;
        }
        if (!this.messageListView.threadViewOwner.threadCache) {
            return;
        }
        this.messageListView.threadViewOwner.threadCache.update({ hasLoadingFailed: false });
        this._loadMore();
    }

    /**
     * @private
     * @param {ScrollEvent} ev
     */
    onScroll(ev) {
        this._onScrollThrottled(ev);
    }

    /**
     * @private
     * @param {ScrollEvent} ev
     */
    _onScrollThrottled(ev) {
        const {
            order,
            orderedMessages,
            thread,
            threadCache,
            threadView,
            threadViewer,
        } = this._lastRenderedValues();
        if (!this.messageListView.scrollableElementRef.el) {
            // could be unmounted in the meantime (due to throttled behavior)
            return;
        }
        const scrollTop = this.messageListView.scrollableElementRef.el.scrollTop;
        this.messaging.messagingBus.trigger('o-component-message-list-scrolled', {
            orderedMessages,
            scrollTop,
            thread,
            threadViewer,
        });
        if (this.messageListView) {
            this.messageListView.update({
                clientHeight: this.messageListView.scrollableElementRef.el.clientHeight,
                scrollHeight: this.messageListView.scrollableElementRef.el.scrollHeight,
                scrollTop: this.messageListView.scrollableElementRef.el.scrollTop,
            });
        }
        if (!this._isLastScrollProgrammatic && threadView && threadView.exists()) {
            // Automatically scroll to new received messages only when the list is
            // currently fully scrolled.
            const hasAutoScrollOnMessageReceived = this.messageListView.isAtEnd;
            threadView.update({ hasAutoScrollOnMessageReceived });
        }
        if (threadViewer && threadViewer.exists()) {
            threadViewer.saveThreadCacheScrollHeightAsInitial(this.messageListView.scrollableElementRef.el.scrollHeight, threadCache);
            threadViewer.saveThreadCacheScrollPositionsAsInitial(scrollTop, threadCache);
        }
        if (!this._isLastScrollProgrammatic && this._isLoadMoreVisible()) {
            this._loadMore();
        }
        this._checkMostRecentMessageIsVisible();
        this._isLastScrollProgrammatic = false;
    }

}

Object.assign(MessageList, {
    defaultProps: {
        hasScrollAdjust: true,
    },
    props: {
        hasScrollAdjust: Boolean,
        localId: String,
    },
    template: 'mail.MessageList',
});

registerMessagingComponent(MessageList);
