from odoo import fields, models

class UsersWebauthKeys(models.Model):
    _inherit = "res.users"

    webauth_key_ids = fields.One2many("webauthn.key", "create_uid")

    @property
    def SELF_WRITEABLE_FIELDS(self):
        return super().SELF_WRITEABLE_FIELDS + ['webauth_key_ids']

    @property
    def SELF_READABLE_FIELDS(self):
        return super().SELF_READABLE_FIELDS + ['webauth_key_ids']
