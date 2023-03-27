/* @odoo-module */

import { ChatWindow } from "@mail/web/chat_window/chat_window";
import {
    CHAT_WINDOW_END_GAP_WIDTH,
    CHAT_WINDOW_INBETWEEN_WIDTH,
    CHAT_WINDOW_WIDTH,
} from "@mail/web/chat_window/chat_window_service";
import { useMessaging, useStore } from "@mail/core/messaging_hook";

import {
    Component,
    onWillStart,
    useExternalListener,
    onMounted,
    useRef,
    useEffect,
} from "@odoo/owl";

import { browser } from "@web/core/browser/browser";
import { Dropdown } from "@web/core/dropdown/dropdown";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { localization } from "@web/core/l10n/localization";

export class ChatWindowContainer extends Component {
    static components = { ChatWindow, Dropdown };
    static props = [];
    static template = "mail.ChatWindowContainer";

    get CHAT_WINDOW_END_GAP_WIDTH() {
        return CHAT_WINDOW_END_GAP_WIDTH;
    }

    get CHAT_WINDOW_INBETWEEN_WIDTH() {
        return CHAT_WINDOW_INBETWEEN_WIDTH;
    }

    get CHAT_WINDOW_WIDTH() {
        return CHAT_WINDOW_WIDTH;
    }

    setup() {
        this.services = {
            "mail.messaging": useMessaging(),
            "mail.store": useStore(),
            "mail.chat_window": useService("mail.chat_window"),
        };
        this.hiddenMenuRef = useRef("hiddenMenu");
        useEffect(
            () => this.setHiddenMenuOffset(),
            () => [this.services["mail.chat_window"].hidden]
        );
        onWillStart(() => this.services["mail.messaging"].isReady);
        onMounted(() => this.setHiddenMenuOffset());

        this.onResize();
        useExternalListener(browser, "resize", this.onResize);
    }

    setHiddenMenuOffset() {
        if (!this.hiddenMenuRef.el) {
            return;
        }
        const textDirection = localization.direction;
        const offsetFrom = textDirection === "rtl" ? "left" : "right";
        const visibleOffset =
            CHAT_WINDOW_END_GAP_WIDTH +
            this.services["mail.chat_window"].maxVisible *
                (CHAT_WINDOW_WIDTH + CHAT_WINDOW_END_GAP_WIDTH);
        const oppositeFrom = offsetFrom === "right" ? "left" : "right";
        this.hiddenMenuRef.el.style = `${offsetFrom}: ${visibleOffset}px; ${oppositeFrom}: auto`;
    }

    onResize() {
        while (
            this.services["mail.chat_window"].visible.length >
            this.services["mail.chat_window"].maxVisible
        ) {
            this.services["mail.chat_window"].hide(
                this.services["mail.chat_window"].visible[
                    this.services["mail.chat_window"].visible.length - 1
                ]
            );
        }
        while (
            this.services["mail.chat_window"].visible.length <
                this.services["mail.chat_window"].maxVisible &&
            this.services["mail.chat_window"].hidden.length > 0
        ) {
            this.services["mail.chat_window"].show(this.services["mail.chat_window"].hidden[0]);
        }
        this.setHiddenMenuOffset();
    }

    get unread() {
        let unreadCounter = 0;
        for (const chatWindow of this.services["mail.chat_window"].hidden) {
            unreadCounter += chatWindow.thread.message_unread_counter;
        }
        return unreadCounter;
    }
}

registry
    .category("main_components")
    .add("mail.ChatWindowContainer", { Component: ChatWindowContainer });
