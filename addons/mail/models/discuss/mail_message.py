# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models
from odoo.addons.mail.tools.discuss import Store


class MailMessage(models.Model):
    _inherit = "mail.message"

    def _to_store(self, store: Store, *args, **kwargs):
        super()._to_store(store, *args, **kwargs)
        poll_by_message_id = {}
        for poll in self.env["discuss.poll"].search(
            ("|", ("message_id", "in", self.ids), ("end_message_id", "in", self.ids))
        ):
            poll_by_message_id[poll.message_id.id] = poll
            poll_by_message_id[poll.end_message_id.id] = poll

        for message in self:
            if message.id in poll_by_message_id:
                store.add(poll_by_message_id[message.id])
                store.add(
                    message,
                    {"poll_id": poll_by_message_id[message.id].id},
                )

    def _extras_to_store(self, store: Store, format_reply):
        super()._extras_to_store(store, format_reply=format_reply)
        if format_reply:
            # sudo: mail.message: access to parent is allowed
            for message in self.sudo().filtered(lambda message: message.model == "discuss.channel"):
                store.add(
                    message, {"parentMessage": Store.one(message.parent_id, format_reply=False)}
                )

    def _bus_channel(self):
        self.ensure_one()
        if self.model == "discuss.channel" and self.res_id:
            return self.env["discuss.channel"].browse(self.res_id)._bus_channel()
        guest = self.env["mail.guest"]._get_guest_from_context()
        if self.env.user._is_public() and guest:
            return guest._bus_channel()
        return super()._bus_channel()
