/* @odoo-module */

import { patch } from "@web/core/utils/patch";
import { MockServer } from "@web/../tests/helpers/mock_server";

patch(MockServer.prototype, {
    /**
     * Simulates `_compute_available_operator_ids` on `im_livechat.channel`.
     *
     * @private
     * @param {integer} id
     * @returns {Object}
     */
    _mockImLivechatChannel__computeAvailableOperatorIds(id) {
        const livechatChannel = this.getRecords("im_livechat.channel", [["id", "=", id]])[0];
        const users = this.getRecords("res.users", [["id", "in", livechatChannel.user_ids]]);
        return users.filter((user) => user.im_status === "online");
    },
    /**
     * Simulates `_get_livechat_discuss_channel_vals` on `im_livechat.channel`.
     *
     * @private
     * @param {integer} id
     * @returns {Object}
     */
    _mockImLivechatChannel_getLivechatDiscussChannelVals(
        id,
        anonymous_name,
        previous_operator_id,
        country_id,
        chatbot_script_id
    ) {
        let operatorPartnerId;
        let operatorName;
        if (chatbot_script_id) {
            const [chatbotScript] = this.pyEnv["chatbot.script"].searchRead([
                ["id", "=", chatbot_script_id],
            ]);
            operatorPartnerId = chatbotScript.operator_partner_id[0];
            operatorName = chatbotScript.title;
        }
        const operator = this._mockImLivechatChannel_getOperator(id, previous_operator_id);
        operatorPartnerId = operator?.partner_id || operatorPartnerId;
        operatorName = operator ? operator.livechat_username || operator.name : operatorName;
        if (!operatorPartnerId) {
            return false;
        }
        // partner to add to the discuss.channel
        const membersToAdd = [
            [
                0,
                0,
                {
                    is_pinned: false,
                    partner_id: operatorPartnerId,
                },
            ],
        ];
        const membersName = [
            this.pyEnv.currentUser ? this.pyEnv.currentUser.display_name : anonymous_name,
            operatorName,
        ];
        return {
            channel_partner_ids: [operatorPartnerId],
            channel_member_ids: membersToAdd,
            livechat_active: true,
            livechat_operator_id: operatorPartnerId,
            livechat_channel_id: id,
            anonymous_name: this.pyEnv.currentUser?._is_public() ? false : anonymous_name,
            country_id: country_id,
            channel_type: "livechat",
            name: membersName.join(" "),
        };
    },
    /**
     * Simulates `_get_operator` on `im_livechat.channel`. Simplified mock
     * implementation: returns  the previous operator if he is still available
     * or the first available operator.
     *
     * @private
     * @param {integer} id
     * @returns {Object}
     */
    _mockImLivechatChannel_getOperator(id, previous_operator_id) {
        const availableUsers = this._mockImLivechatChannel__computeAvailableOperatorIds(id);
        return (
            availableUsers.find((operator) => operator.partner_id === previous_operator_id) ??
            availableUsers[0]
        );
    },
});
