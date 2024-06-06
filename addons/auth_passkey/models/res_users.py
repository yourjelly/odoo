import base64
import json

from odoo import fields, models, registry, _
from odoo.tools import SQL
from odoo.exceptions import AccessDenied
from odoo.http import request

from odoo.addons.base.models.res_users import check_identity
from ..lib.duo_labs.webauthn.helpers.exceptions import InvalidAuthenticationResponse


class UsersPasskey(models.Model):
    _inherit = 'res.users'

    auth_passkey_key_ids = fields.One2many('auth.passkey.key', 'create_uid')

    @property
    def SELF_READABLE_FIELDS(self):
        return super().SELF_READABLE_FIELDS + ['auth_passkey_key_ids']

    @check_identity
    def action_create_passkey(self):
        return {
            'name': _('Create Passkey'),
            'type': 'ir.actions.act_window',
            'res_model': 'auth.passkey.key.name',
            'view_mode': 'form',
            'target': 'new',
            'context': {
                'dialog_size': 'medium',
            }
        }

    @classmethod
    def _login(cls, db, credential, user_agent_env):
        if credential['type'] == 'webauthn':
            webauthn = json.loads(credential['webauthn_response'])
            with registry(db).cursor() as cr:
                identifier = base64.urlsafe_b64decode(webauthn['id'] + '===').hex()
                cr.execute(SQL("""
                    SELECT login
                      FROM auth_passkey_key key
                      JOIN res_users usr ON usr.id = key.create_uid
                     WHERE credential_identifier=%s
                """, identifier))
                res = cr.fetchone()
                if not res:
                    raise AccessDenied(_('Unknown passkey'))
                credential['login'] = res[0]
        return super()._login(db, credential, user_agent_env=user_agent_env)

    def _check_credentials(self, credential, env):
        if credential['type'] == 'webauthn':
            webauthn = json.loads(credential['webauthn_response'])
            identifier = base64.urlsafe_b64decode(webauthn['id'] + '===').hex()
            passkey = self.env['auth.passkey.key'].sudo().search([
                ("create_uid", "=", self.env.user.id),
                ("credential_identifier", "=", identifier),
            ])
            if not passkey:
                raise AccessDenied(_('Unknown passkey'))
            try:
                new_sign_count = self.env['auth.passkey.key']._verify_auth(
                    webauthn,
                    request.session.pop('webauthn_challenge'),
                    passkey.public_key,
                    passkey.sign_count,
                )
            except InvalidAuthenticationResponse as e:
                raise AccessDenied(e.args[0])
            passkey.sign_count = new_sign_count
            credential['skip_totp'] = True
            return {
                'uid': self.env.user.id,
                'auth_method': 'passkey',
                'mfa': 'skip',
            }
        else:
            return super()._check_credentials(credential, env)
