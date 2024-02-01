from odoo import fields, models

class WebauthnKey(models.Model):
    _name = "webauthn.key"
    _description = "Passkeys"

    name = fields.Char(required=True)
    credential_identifier = fields.Char(required=True)
    public_key = fields.Char(required=True)
    sign_count = fields.Integer(default=0)

    def _get_nopw_user_by_id(self, id):
        # We strip the = because webauthn base64 padding behaves a little different depending on the platform (win/yubi)
        results = self.sudo().search([("credential_identifier", "like", id.strip("=")+"%")])
        if len(results) == 1:
            return results[0]
        return False
