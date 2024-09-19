from odoo import fields, models
from odoo.addons.mail.tools.discuss import Store


class MailLinkPreviewMessage(models.Model):
    _name = "mail.link.preview.message"
    _inherit = ["bus.listener.mixin"]
    _description = "Link between link previews and messages"

    link_preview_id = fields.Many2one("mail.link.preview", index=True, required=True, ondelete="cascade")
    message_id = fields.Many2one("mail.message")
    is_hidden = fields.Boolean()

    def init(self):
        self.env.cr.execute("CREATE UNIQUE INDEX IF NOT EXISTS mail_link_preview_id_message_id ON %s (message_id, link_preview_id)" % self._table)

    def _bus_channel(self):
        return self.message_id._bus_channel()

    def _hide_and_notify(self):
        if not self:
            return True
        self.is_hidden = True
        for link_preview_message in self:
            link_preview_message._bus_send_store(link_preview_message)

    def _unlink_and_notify(self):
        if not self:
            return True
        for link_preview_message in self:
            link_preview_message._bus_send_store(link_preview_message)
        self.unlink()

    def _to_store(
        self,
        store: Store,
        /,
    ):
        for link_preview_message in self:
            if (not link_preview_message.is_hidden):
                store.add(link_preview_message, {
                    "link_preview_id": Store.one(link_preview_message.link_preview_id),
                    "message_id": Store.one(link_preview_message.message_id, only_id=True),
                })
            else:
                store.add(link_preview_message, delete=True)
