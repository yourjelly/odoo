import { FEATURES } from "@im_livechat/embed/common/features";
import { feature } from "@mail/core/common/features";

import { Message } from "@mail/core/common/message_model";
import { Record } from "@mail/core/common/record";

feature(FEATURES.EMBED_LIVECHAT).registerPatch(Message.prototype, {
    setup() {
        super.setup();
        this.chatbotStep = Record.one("ChatbotStep", { inverse: "message" });
    },
});
