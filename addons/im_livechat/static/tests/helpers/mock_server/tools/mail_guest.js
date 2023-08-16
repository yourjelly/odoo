/* @odoo-module */

import { Command } from "@mail/../tests/helpers/command";

import { patch } from "@web/core/utils/patch";
import { MockServer } from "@web/../tests/helpers/mock_server";

patch(MockServer.prototype, {
    /**
     * Simulates `get_current_persona_for_channel` on `tools/mail_guest`.
     */
    _mockGetCurrentPersonaForChannel(channelId, guestName, addAsMember = true) {
        if (this._mockDiscussChannelMember__getAsSudoFromContext(channelId)) {
            return;
        }
        const guestId = this._mockGetGuestForChannel(channelId, guestName, addAsMember);
        this._mockAddGuestCookie(guestId);
    },
    /**
     * Simulates `get_guest_for_channel` on `tools/mail_guest`.
     */
    _mockGetGuestForChannel(channelId, guestName, addAsMember = true) {
        const guestId =
            this._mockMailGuest__getGuestFromContext()?.id ??
            this.pyEnv["mail.guest"].create({ name: guestName });
        if (addAsMember) {
            this.pyEnv["discuss.channel"].write([channelId], {
                channel_member_ids: [Command.create({ guest_id: guestId })],
            });
        }
        return guestId;
    },
    /**
     * Simulates `get_guest_from_context` on `tools/mail_guest`.
     */
    _mockAddGuestCookie(guestId) {
        this.pyEnv.cookie.set("dgid", guestId);
    },
});
