import { FEATURES } from "@im_livechat/embed/common/features";
import { feature } from "@mail/core/common/features";

import { ThreadService } from "@mail/core/common/thread_service";

feature(FEATURES.EMBED_LIVECHAT).registerPatch(ThreadService.prototype, {
    /**
     * @returns {Promise<import("models").Message}
     */
    async post(thread, body, params) {
        if (thread.channel_type === "livechat") {
            thread = await this.env.services["im_livechat.livechat"].persist();
            if (!thread) {
                return;
            }
        }
        const message = await super.post(thread, body, params);
        this.env.services["im_livechat.chatbot"].bus.trigger("MESSAGE_POST", message);
        return message;
    },
});
