from odoo import fields, models


class ResUser(models.Model):
    _inherit = "res.user"

    event_track_email_reminder = fields.Char("Email reminder")