from odoo import fields, models


class ResUsers(models.Model):
    _inherit = 'res.users'

    lock_timeout_inactivity = fields.Float(
        string="Lock for inactivity after (minutes)",
        help="Delay before asking the user to re-confirm his identity because of inactivity",
    )
    lock_timeout = fields.Float(
        string="Re-confirm identity every (minutes)",
        help="Delay before asking the user to re-confirm his identity (even if active)",
    )

    def _get_auth_methods(self):
        self.ensure_one()
        auth_methods = []
        if self.auth_passkey_key_ids:
            auth_methods.append("webauthn")
        if mfa_type := self._mfa_type():
            auth_methods.append(mfa_type)
        auth_methods.append("password")
        return auth_methods
