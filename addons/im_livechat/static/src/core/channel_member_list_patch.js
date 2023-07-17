/* @odoo-module */

import { ChannelMemberList } from "@mail/discuss/core/common/channel_member_list";
import { patch } from "@web/core/utils/patch";

ChannelMemberList.props.push("openChannelInvitePanel?");
patch(ChannelMemberList.prototype, "im_livechat", {
    canOpenChatWith(member) {
        return this._super(member) && !member.persona.is_public;
    },

    onClickAddUser() {
        this.props.openChannelInvitePanel?.(this.env.inChatWindow);
    },
});
