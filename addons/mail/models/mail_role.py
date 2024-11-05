from odoo import fields, models


class MailRole(models.Model):
    _description = "Role in Mail"

    name = fields.Char(required=True, translate=True)
    # user_ids = ßfields.Many2many("res.users", string="Users")
