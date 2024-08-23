import { models, serverState } from "@web/../tests/web_test_helpers";

export class ResUsers extends models.ServerModel {
    _name = "res.users";

    /**
     * @override
     */
    _init_store_data() {
        const res = super._init_store_data(...arguments);
        res.Store.has_access_livechat = this.env.user.groups_id.includes(
            serverState.groupLivechatId
        );
        return res;
    }
}
