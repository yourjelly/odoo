/** @odoo-module */

import { browser } from "@web/core/browser/browser";
import { registry } from "@web/core/registry";

export class AutopopupService {
    constructor(
        env,
        {
            "im_livechat.livechat": livechatService,
            "mail.thread": threadService,
            "mail.store": storeService,
        }
    ) {
        this.threadService = threadService;
        this.storeService = storeService;
        livechatService.initializedDeferred.then(() => {
            if (livechatService.shouldRestoreSession) {
                threadService.openChat();
            } else if (!storeService.isSmall && livechatService.rule?.action === "auto_popup") {
                browser.setTimeout(async () => {
                    if (await this.shouldOpenChatWindow()) {
                        threadService.openChat();
                    }
                }, livechatService.rule.auto_popup_timer * 1000);
            }
        });
    }

    /**
     * Determines if a chat window should be opened. This is the case if
     * there is an available operator and if no chat window linked to
     * the session exists.
     *
     * @returns {Promise<boolean>}
     */
    async shouldOpenChatWindow() {
        const thread = await this.threadService.getLivechatThread();
        return this.storeService.chatWindows.every(
            (chatWindow) => chatWindow.thread.localId !== thread?.localId
        );
    }
}

export const autoPopupService = {
    dependencies: ["im_livechat.livechat", "mail.thread", "mail.store"],

    start(env, services) {
        return new AutopopupService(env, services);
    },
};
registry.category("services").add("im_livechat.autopopup", autoPopupService);
