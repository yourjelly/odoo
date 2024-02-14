/* @odoo-module */

import { LivechatChannel } from "@im_livechat/core/web/livechat_channel_model";
import { _t } from "@web/core/l10n/translation";
import { patch } from "@web/core/utils/patch";
import { DiscussAppCategory } from "@mail/core/common/discuss_app_category_model";
import { Record } from "@mail/core/common/record";
import { compareDatetime } from "@mail/utils/common/misc";

patch(DiscussAppCategory.prototype, {
    setup() {
        this.livechatChannel = Record.one("LivechatChannel", { inverse: "discussAppCategory" });
    },
    /**
     * @param {import("models").Thread} t1
     * @param {import("models").Thread} t2
     */
    sortThreads(t1, t2) {
        if (this.isLivechatCategory) {
            return (
                compareDatetime(t2.lastInterestDateTime, t1.lastInterestDateTime) || t2.id - t1.id
            );
        }
        return super.sortThreads(t1, t2);
    },

    get isLivechatCategory() {
        return this.id.startsWith(LivechatChannel.APP_CATEGORY_PREFIX);
    },

    get joinTitle() {
        return this.livechatChannel ? _t("Join %s", this.livechatChannel.name) : "";
    },

    get leaveTitle() {
        return this.livechatChannel ? _t("Leave %s", this.livechatChannel.name) : "";
    },
});

patch(DiscussAppCategory, {
    insert() {
        const category = super.insert(...arguments);
        if (category.isLivechatCategory) {
            category._store.settings[category.openStateKey] ??= true;
        }
        return category;
    },
});
