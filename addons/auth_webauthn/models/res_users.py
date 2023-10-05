from base64 import b64encode 
from odoo import _, fields, models
from odoo.addons.base.models.res_users import check_identity
from odoo.exceptions import UserError
from urllib.parse import urlparse
from webauthn import generate_registration_options, options_to_json
from webauthn.helpers.structs import AuthenticatorSelectionCriteria, UserVerificationRequirement, ResidentKeyRequirement

class Users(models.Model):
    _inherit = 'res.users'

    webauthn_enabled = fields.Boolean(string="Webauthn enabled")
    webauthn_challenge = fields.Char(string="Webauthn challenge")
    webauthn_ids = fields.One2many('auth_webauthn.wizard', 'user_id', string="Webauthn credentials")

    @check_identity
    def action_webauthn_enable_wizard(self):
        if self.env.user != self:
            raise UserError(_("Two-factor authentication can only be enabled for yourself"))

        if self.webauthn_enabled:
            raise UserError(_("Two-factor authentication already enabled"))

        options = generate_registration_options(
            rp_name="Odoo",
            rp_id=urlparse(self.env["ir.config_parameter"].sudo().get_param("web.base.url")).netloc,
            user_id=str(self.id),
            user_name=self.login,
            authenticator_selection=AuthenticatorSelectionCriteria(
                resident_key=ResidentKeyRequirement.PREFERRED,
                user_verification=UserVerificationRequirement.REQUIRED
            )
        )

        self.sudo().webauthn_challenge = b64encode(options.challenge).decode()

        return {
            'type': 'ir.actions.client',
            'tag': 'webauthn_register_begin',
            'params': {
                'options': options_to_json(options)
            }
        }

    @check_identity
    def action_webauthn_disable(self):
        if self.env.user != self:
            raise UserError(_("Two-factor authentication can only be enabled for yourself"))

        if not self.webauthn_enabled:
            raise UserError(_("Web authentication already disabled"))

        self.webauthn_enabled = False
        self.webauthn_challenge = b""
        self.webauthn_ids.unlink()
    

    def _mfa_url(self):
        r = super()._mfa_url()
        if r is not None:
            return r
        if self._mfa_type() == 'webauthn':
            return '/web/login/webauthn'


    def _mfa_type(self):
        r = super()._mfa_type()
        if r is not None:
            return r
        if self.webauthn_enabled:
            return 'webauthn'
