from odoo import fields, models



class UserPresence(models.Model):
    _name = "user.presence"
    _description = "User Presence"
    _log_access = False
    _sql_constraints = [
        ("websocket_uuid_unique", "unique(websocket_uuid)", "Websocket UUID must be unique"),
    ]

    user_id = fields.Many2one("res.users", "Users", ondelete="cascade", index=True)
    websocket_uuid = fields.Char("Websocket UUID")
    last_websocket_presence = fields.Datetime("Last Websocket Heartbeat", default=lambda _: fields.Datetime.now())
    status = fields.Selection([("online", "Online"), ("away", "Away")], "IM Status", default=lambda _: "online")

    def _on_status_change(self, new_status):
        self.env["bus.bus"]._sendone("broadcast", "mail.record/insert", {
            "Persona": {
                "id": self.env.user.partner_id.id,
                "im_status": new_status,
                "type": "partner",
            },
        })
