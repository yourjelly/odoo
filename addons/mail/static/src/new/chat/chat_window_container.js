/* @odoo-module */

import { Component } from "@odoo/owl";
import { useMessaging } from "../messaging_hook";
import { ChatWindow } from "./chat_window";

export class ChatWindowContainer extends Component {
    static components = { ChatWindow };
    static props = [];
    static template = "mail.chat_window_container";

    setup() {
        this.messaging = useMessaging();
    }

    get chatWindows() {
        return this.messaging.state.discuss.isActive ? [] : this.messaging.state.chatWindows;
    }
}
