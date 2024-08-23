import { models, serverState } from "@web/../tests/web_test_helpers";

export class ResGroups extends models.ServerModel {
    _name = "res.groups";

    _records = [
        ...this._records,
        {
            id: serverState.groupLivechatId,
            name: "Livechat User",
        },
    ];
}
