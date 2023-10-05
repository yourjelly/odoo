from base64 import b64decode
from odoo import _, api, models, fields
from odoo.exceptions import UserError, ValidationError
from webauthn import verify_registration_response
from webauthn.helpers.structs import RegistrationCredential
from webauthn.helpers.exceptions import InvalidRegistrationResponse
from urllib.parse import urlparse


class WebAuthnWizard(models.TransientModel):
    _name = "auth_webauthn.wizard"
    _description = "2-Factor setup wizard"

    credential_id = fields.Binary(string="Credential ID", attachment=False)
    public_key = fields.Binary(string="Public key", attachment=False)
    sign_count = fields.Integer(string="Sign count")
    user_id = fields.Many2one('res.users', required=True, readonly=True)


    @api.model
    def verifyAttestation(self, options):
        creds = RegistrationCredential.model_validate_json(options)

        verif = verify_registration_response(
            credential=creds,
            expected_challenge=b64decode(self.env.user.webauthn_challenge),
            expected_rp_id=urlparse(self.env["ir.config_parameter"].sudo().get_param("web.base.url")).netloc.split(":")[0],
            expected_origin=self.env["ir.config_parameter"].sudo().get_param("web.base.url"),
            require_user_verification=True,
        )

        if not verif.user_verified:
            raise UserError(_("User verification failed"))

        self.create({
            'user_id': self.env.user.id,
            'credential_id': verif.credential_id,
            'public_key': verif.credential_public_key,
            'sign_count': verif.sign_count,
        })

        print(self.env.user.name)
        self.env.user.sudo().webauthn_enabled = True