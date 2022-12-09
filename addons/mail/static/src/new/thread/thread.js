/* @odoo-module */

import { Component, onMounted, onWillStart, onWillUpdateProps, useRef } from "@odoo/owl";
import { useMessaging } from "../messaging_hook";
import { useAutoScroll, useScrollSnapshot, useVisible } from "@mail/new/utils/hooks";
import { Message } from "./message";

import { Transition } from "@web/core/transition";

export class Thread extends Component {
    setup() {
        this.messaging = useMessaging();
        if (!this.env.inChatter) {
            useAutoScroll(
                "messages",
                () =>
                    !this.props.messageHighlight ||
                    !this.props.messageHighlight.highlightedMessageId
            );
        }
        this.messagesRef = useRef("messages");
        this.pendingLoadMore = false;
        this.loadMoreState = useVisible("load-more", () => this.loadMore());
        this.oldestNonTransientMessageId = null;
        useScrollSnapshot("messages", {
            onWillPatch: () => {
                return {
                    hasMoreMsgsAbove:
                        this.thread.oldestNonTransientMessage?.id !==
                            this.oldestNonTransientMessage && this.props.order === "asc",
                };
            },
            onPatched: ({ hasMoreMsgsAbove, scrollTop, scrollHeight }) => {
                const el = this.messagesRef.el;
                const wasPendingLoadMore = this.pendingLoadMore;
                if (hasMoreMsgsAbove) {
                    el.scrollTop = scrollTop + el.scrollHeight - scrollHeight;
                    this.pendingLoadMore = false;
                }
                this.oldestNonTransientMessage = this.thread.oldestNonTransientMessage?.id;
                if (!wasPendingLoadMore) {
                    this.loadMore();
                }
            },
        });
        onMounted(() => {
            this.oldestNonTransientMessage = this.thread.oldestNonTransientMessage?.id;
            this.loadMore();
        });
        onWillStart(() => this.requestMessages(this.props.id));
        onWillUpdateProps((nextProps) => this.requestMessages(nextProps.id));
    }

    get thread() {
        return this.messaging.state.threads[this.props.id];
    }

    loadMore() {
        if (
            this.loadMoreState.isVisible &&
            this.thread.status !== "loading" &&
            !this.pendingLoadMore
        ) {
            this.messaging.fetchThreadMessagesMore(this.props.id);
            this.pendingLoadMore = true;
        }
    }

    requestMessages(threadId) {
        // does not return the promise, so the thread is immediately rendered
        // then updated whenever messages get here
        this.messaging.fetchThreadMessagesNew(threadId);
    }

    isGrayedOut(msg) {
        const { messageToReplyTo } = this.messaging.state.discuss;
        return (
            messageToReplyTo &&
            messageToReplyTo.id !== msg.id &&
            messageToReplyTo.resId === msg.resId
        );
    }

    isSquashed(msg, prevMsg) {
        if (!prevMsg || prevMsg.type === "notification" || prevMsg.isEmpty || this.env.inChatter) {
            return false;
        }

        if (msg.author?.id !== prevMsg.author?.id) {
            return false;
        }
        if (msg.resModel !== prevMsg.resModel || msg.resId !== prevMsg.resId) {
            return false;
        }
        if (msg.parentMessage) {
            return false;
        }
        return msg.dateTime.ts - prevMsg.dateTime.ts < 60 * 1000;
    }
}

Object.assign(Thread, {
    components: { Message, Transition },
    props: ["id", "messageHighlight?", "order?"],
    defaultProps: {
        order: "asc", // 'asc' or 'desc'
    },
    template: "mail.thread",
});
