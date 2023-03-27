/* @odoo-module */

import { ImStatus } from "@mail/discuss/im_status";

import { useMessaging, useStore } from "@mail/core/messaging_hook";
import { NotificationItem } from "@mail/web/messaging_menu/notification_item";
import { ChannelSelector } from "@mail/discuss/channel_selector";
import { createLocalId } from "@mail/utils/misc";
import { onExternalClick } from "@mail/utils/hooks";
import { Component, useState } from "@odoo/owl";

import { Dropdown } from "@web/core/dropdown/dropdown";
import { _t } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { sprintf } from "@web/core/utils/strings";
import { hasTouch } from "@web/core/browser/feature_detection";

export class MessagingMenu extends Component {
    static components = { Dropdown, NotificationItem, ImStatus, ChannelSelector };
    static props = [];
    static template = "mail.MessagingMenu";

    setup() {
        this.hasTouch = hasTouch;
        this.services = {
            "mail.messaging": useMessaging(),
            "mail.store": useStore(),
            "mail.notification.permission": useState(useService("mail.notification.permission")),
            /** @type {import('@mail/web/chat_window/chat_window_service').ChatWindowService} */
            "mail.chat_window": useService("mail.chat_window"),
            /** @type {import('@mail/core/thread_service').ThreadService} */
            "mail.thread": useService("mail.thread"),
            /** @type {import('@mail/core/thread_message_fetch_service').ThreadMessageFetchService} */
            "mail.thread.message_fetch": useService("mail.thread.message_fetch"),
        };
        this.action = useService("action");
        this.state = useState({
            addingChat: false,
            addingChannel: false,
            isOpen: false,
        });
        onExternalClick("selector", () => {
            Object.assign(this.state, { addingChat: false, addingChannel: false });
        });
    }

    beforeOpen() {
        this.services["mail.messaging"].fetchPreviews();
        if (
            !this.services["mail.store"].discuss.inbox.isLoaded &&
            this.services["mail.store"].discuss.inbox.status !== "loading" &&
            this.services["mail.store"].discuss.inbox.counter !==
                this.services["mail.store"].discuss.inbox.messages.length
        ) {
            this.services["mail.thread.message_fetch"].fetchMessages(
                this.services["mail.store"].discuss.inbox
            );
        }
    }

    onClickPreview(isMarkAsRead, preview) {
        const { thread } = preview;
        if (!isMarkAsRead) {
            this.openDiscussion(thread);
            return;
        }
        this.markAsRead(preview);
    }

    markAsRead(preview) {
        const { thread, isNeedaction } = preview;
        if (isNeedaction) {
            this.services["mail.thread"].markAllMessagesAsRead(thread);
        } else {
            this.services["mail.thread"].markAsRead(thread);
        }
    }

    createLocalId(...args) {
        return createLocalId(...args);
    }

    /**
     * @param {'chat' | 'group'} tab
     * @returns Thread types matching the given tab.
     */
    tabToThreadType(tab) {
        return tab === "chat" ? ["chat", "group"] : [tab];
    }

    get hasPreviews() {
        return (
            this.displayedPreviews.length > 0 ||
            (this.services["mail.store"].notificationGroups.length > 0 &&
                this.services["mail.store"].discuss.activeTab === "all") ||
            (this.services["mail.notification.permission"].permission === "prompt" &&
                this.services["mail.store"].discuss.activeTab === "all")
        );
    }

    get notificationRequest() {
        return {
            body: _t("Enable desktop notifications to chat"),
            displayName: sprintf(
                _t("%s has a request"),
                this.services["mail.store"].partnerRoot.name
            ),
            iconSrc: this.services["mail.thread"].avatarUrl(
                this.services["mail.store"].partnerRoot
            ),
            partner: this.services["mail.store"].partnerRoot,
            isLast:
                this.displayedPreviews.length === 0 &&
                this.services["mail.store"].notificationGroups.length === 0,
            isShown:
                this.services["mail.store"].discuss.activeTab === "all" &&
                this.services["mail.notification.permission"].permission === "prompt",
        };
    }

    get displayedPreviews() {
        /** @type {import("@mail/core/thread_model").Thread[]} **/
        let threads = Object.values(this.services["mail.store"].threads).filter(
            (thread) =>
                thread.is_pinned || (thread.hasNeedactionMessages && thread.type !== "mailbox")
        );
        const tab = this.services["mail.store"].discuss.activeTab;
        if (tab !== "all") {
            threads = threads.filter(({ type }) => this.tabToThreadType(tab).includes(type));
        }
        threads.sort((a, b) => {
            if (!a.mostRecentNonTransientMessage?.datetime) {
                return -1;
            }
            if (!b.mostRecentNonTransientMessage?.datetime) {
                return 1;
            }
            return (
                b.mostRecentNonTransientMessage.datetime - a.mostRecentNonTransientMessage.datetime
            );
        });
        const previews = [];
        for (const thread of threads) {
            const { mostRecentMsg, mostRecentNeedactionMsg } = thread;
            if (thread.is_pinned) {
                const message = mostRecentMsg;
                previews.push({
                    id: `preview-${thread.localId}`,
                    count: this.services["mail.thread"].localMessageUnreadCounter(thread),
                    imgUrl: thread.imgUrl,
                    hasMarkAsReadButton: this.services["mail.thread"].isUnread(thread),
                    message,
                    thread,
                    isNeedaction: false,
                });
            }
            if (mostRecentNeedactionMsg) {
                const message = mostRecentNeedactionMsg;
                previews.push({
                    id: `preview-needaction-${thread.localId}`,
                    count: thread.needactionMessages.length,
                    imgUrl: message.module_icon,
                    hasMarkAsReadButton: true,
                    message,
                    thread,
                    isNeedaction: true,
                });
            }
        }
        return previews;
    }

    /**
     * @type {{ id: string, icon: string, label: string }[]}
     */
    get tabs() {
        if (this.env.inDiscussApp) {
            return [
                {
                    icon: "fa fa-inbox",
                    id: "mailbox",
                    label: _t("Mailboxes"),
                },
                {
                    icon: "fa fa-user",
                    id: "chat",
                    label: _t("Chat"),
                },
                {
                    icon: "fa fa-users",
                    id: "channel",
                    label: _t("Channel"),
                },
            ];
        } else {
            return [
                {
                    icon: "fa fa-envelope",
                    id: "all",
                    label: _t("All"),
                },
                {
                    icon: "fa fa-user",
                    id: "chat",
                    label: _t("Chat"),
                },
                {
                    icon: "fa fa-users",
                    id: "channel",
                    label: _t("Channel"),
                },
            ];
        }
    }

    openDiscussion(thread) {
        this.services["mail.thread"].open(thread);
        this.close();
    }

    onClickNewMessage() {
        if (this.services["mail.store"].isSmall && this.env.inDiscussApp) {
            this.state.addingChat = true;
        } else {
            this.services["mail.chat_window"].openNewMessage();
        }
        this.close();
    }

    /**
     *
     * @param {import("@mail/core/notification_group_model").NotificationGroup} failure
     */
    onClickFailure(failure) {
        const originThreadIds = new Set(
            failure.notifications.map(({ message }) => message.originThread.id)
        );
        if (originThreadIds.size === 1) {
            const message = failure.notifications[0].message;
            this.openThread(message.originThread);
        } else {
            this.openFailureView(failure);
            this.close();
        }
    }

    openThread(thread) {
        if (this.services["mail.store"].discuss.isActive) {
            this.action.doAction({
                type: "ir.actions.act_window",
                res_model: thread.model,
                views: [[false, "form"]],
                res_id: thread.id,
            });
            // Close the related chat window as having both the form view
            // and the chat window does not look good.
            this.services["mail.store"].chatWindows.find(({ thr }) => thr === thread)?.close();
        } else {
            this.services["mail.thread"].open(thread);
        }
        this.close();
    }

    openFailureView(failure) {
        if (failure.type !== "email") {
            return;
        }
        this.action.doAction({
            name: _t("Mail Failures"),
            type: "ir.actions.act_window",
            view_mode: "kanban,list,form",
            views: [
                [false, "kanban"],
                [false, "list"],
                [false, "form"],
            ],
            target: "current",
            res_model: failure.resModel,
            domain: [["message_has_error", "=", true]],
            context: { create: false },
        });
    }

    cancelNotifications(failure) {
        return this.env.services.orm.call(failure.resModel, "notify_cancel_by_type", [], {
            notification_type: failure.type,
        });
    }

    close() {
        // hack: click on window to close dropdown, because we use a dropdown
        // without dropdownitem...
        document.body.click();
    }

    onClickNavTab(tabId) {
        if (this.services["mail.store"].discuss.activeTab === tabId) {
            return;
        }
        this.services["mail.store"].discuss.activeTab = tabId;
        if (
            this.services["mail.store"].discuss.activeTab === "mailbox" &&
            (!this.services["mail.store"].discuss.threadLocalId ||
                this.services["mail.store"].threads[
                    this.services["mail.store"].discuss.threadLocalId
                ].type !== "mailbox")
        ) {
            this.services["mail.thread"].setDiscussThread(
                Object.values(this.services["mail.store"].threads).find(
                    (thread) => thread.id === "inbox"
                )
            );
        }
        if (this.services["mail.store"].discuss.activeTab !== "mailbox") {
            this.services["mail.store"].discuss.threadLocalId = null;
        }
    }

    get counter() {
        let value =
            this.services["mail.store"].discuss.inbox.counter +
            Object.values(this.services["mail.store"].threads).filter(
                (thread) => thread.is_pinned && this.services["mail.thread"].isUnread(thread)
            ).length +
            Object.values(this.services["mail.store"].notificationGroups).reduce(
                (acc, ng) => acc + parseInt(Object.values(ng.notifications).length),
                0
            );
        if (this.services["mail.notification.permission"].permission === "prompt") {
            value++;
        }
        return value;
    }
}

registry
    .category("systray")
    .add("mail.messaging_menu", { Component: MessagingMenu }, { sequence: 25 });
