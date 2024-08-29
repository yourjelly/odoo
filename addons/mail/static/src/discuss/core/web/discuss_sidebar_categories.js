import { ImStatus } from "@mail/core/common/im_status";
import { ThreadIcon } from "@mail/core/common/thread_icon";
import { discussSidebarItemsRegistry } from "@mail/core/web/discuss_sidebar";
import { ChannelSelector } from "@mail/discuss/core/web/channel_selector";
import { onExternalClick } from "@mail/utils/common/hooks";
import { cleanTerm } from "@mail/utils/common/format";
import { Component, useState } from "@odoo/owl";

import { _t } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { markEventHandled } from "@web/core/utils/misc";
import { usePopover } from "@web/core/popover/popover_hook";
import { DiscussSidebarChannelCommands } from "./discuss_sidebar_channel_commands";
export const discussSidebarChannelIndicatorsRegistry = registry.category(
    "mail.discuss_sidebar_channel_indicators"
);

/**
 * @typedef {Object} Props
 * @extends {Component<Props, Env>}
 */
export class DiscussSidebarCategories extends Component {
    static template = "mail.DiscussSidebarCategories";
    static props = {};
    static components = { ChannelSelector, ImStatus, ThreadIcon };

    setup() {
        super.setup();
        this.store = useState(useService("mail.store"));
        this.discussCoreWebService = useState(useService("discuss.core.web"));
        this.state = useState({
            editing: false,
            quickSearchVal: "",
        });
        this.actionService = useService("action");
        this.orm = useService("orm");
        onExternalClick("selector", () => {
            this.state.editing = false;
        });
        this.popover = usePopover(DiscussSidebarChannelCommands, {
            position: "right-start",
            onClose: () => (this.currentThread.settingsVisibility = false),
            popoverClass: "o-mail-DiscussSidebar-commandsPopover",
        });
    }

    onClickCommands(event, thread) {
        this.currentThread = thread;
        this.currentThread.settingsVisibility = true;
        const { isOpen, open, close } = this.popover;
        const targetElement = event.target.closest(".o-mail-DiscussSidebarChannel-commands");
        if (!isOpen) {
            open(targetElement, {
                thread,
                close: close,
            });
        } else {
            this.currentThread.settingsVisibility = false;
            close();
        }
    }

    addToCategory(category) {
        this.state.editing = category.id;
    }

    get channelIndicators() {
        return discussSidebarChannelIndicatorsRegistry.getAll();
    }

    filteredThreads(category) {
        return category.threads.filter((thread) => {
            return (
                (thread.displayToSelf || thread.isLocallyPinned) &&
                (!this.state.quickSearchVal ||
                    cleanTerm(thread.displayName).includes(cleanTerm(this.state.quickSearchVal)))
            );
        });
    }

    get hasQuickSearch() {
        return (
            Object.values(this.store.Thread.records).filter(
                (thread) => thread.is_pinned && thread.model === "discuss.channel"
            ).length > 19
        );
    }

    openCategory(category) {
        if (category.id === "channels") {
            this.actionService.doAction({
                name: _t("Public Channels"),
                type: "ir.actions.act_window",
                res_model: "discuss.channel",
                views: [
                    [false, "kanban"],
                    [false, "form"],
                ],
                domain: [["channel_type", "=", "channel"]],
            });
        }
    }

    /**
     * @param {MouseEvent} ev
     * @param {import("models").Thread} thread
     */
    openThread(ev, thread) {
        markEventHandled(ev, "sidebar.openThread");
        thread.setAsDiscussThread();
    }

    stopEditing() {
        this.state.editing = false;
    }

    /**
     *
     * @param {import("models").DiscussAppCategory} category
     */
    toggleCategory(category) {
        if (this.store.channels.status === "fetching") {
            return;
        }
        category.open = !category.open;
        this.discussCoreWebService.broadcastCategoryState(category);
    }
}

discussSidebarItemsRegistry.add("channels", DiscussSidebarCategories, { sequence: 30 });
