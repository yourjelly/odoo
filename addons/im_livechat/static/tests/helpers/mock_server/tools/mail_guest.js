/* @odoo-module */

import { Command } from "@mail/../tests/helpers/command";

import { patch } from "@web/core/utils/patch";
import { MockServer } from "@web/../tests/helpers/mock_server";

patch(MockServer.prototype, {
    /**
     * Simulates `find_or_create_persona_for_channel` on `tools/mail_guest`.
     */
    _mockFindOrCreatePersonaForChannel(channelId, guestName, addAsMember = true) {
        if (this._mockDiscussChannelMember__getAsSudoFromContext(channelId)) {
            return;
        }
        const guestId = this._mockFindOrCreateGuestForChannel(channelId, guestName, addAsMember);
        this._mockSetGuestCookie(guestId);
    },
    /**
     * Simulates `find_or_create_guest_for_channel` on `tools/mail_guest`.
     */
    _mockFindOrCreateGuestForChannel(channelId, guestName, addAsMember = true) {
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
     * Simulates `set_guest_cookie` on `tools/mail_guest`.
     */
    _mockSetGuestCookie(guestId) {
        this.pyEnv.cookie.set("dgid", guestId);
    },
});
