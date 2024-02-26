# Part of Odoo. See LICENSE file for full copyright and licensing details.

import base64
import uuid

from webauthn import verify_registration_response
from webauthn.helpers import bytes_to_base64url

from odoo import fields, models
from odoo.exceptions import AccessDenied


class Users(models.Model):
    _inherit = 'res.users'

    passkey = fields.Char(string="Unique User ID", compute='_compute_passkey', store=True)
    credential_ids = fields.One2many(
        string="Public Keys",
        comodel_name='public.key.credential',
        inverse_name='user_id',
    )

    def _compute_passkey(self):
        for user in self:
            user.passkey = base64.b64encode(uuid.uuid4().bytes)

    def get_passkey_credential_options(self):
        self.ensure_one()
        chal_bytes = uuid.uuid4().bytes
        challenge = base64.b64encode(chal_bytes)
        # print(chal_bytes, challenge)
        return {
            'challenge': challenge,
            'rp': {
                'name': "Example",  # company?
                'id': self.get_base_url().replace("http://", "").replace("https://", "").split(':')[0],  # base url?
                # 'id': 'localhost',
            },
            'user': {
                'id': self.passkey,
                'name': self.login,
                'displayName': self.display_name,
            },
            'pubKeyCredParams': [
                {
                    'alg': -7,
                    'type': "public-key"
                },
                {
                    'alg': -257,
                    'type': "public-key"
                }
            ],
            'excludeCredentials': [],
            # [{
            #     'id': cred.key,
            #     'type': cred.type,
            # } for cred in self.credential_ids], # existing credentials? [{id: ***, type: 'public-key', transports: ['internal']},]
            'authenticatorSelection': {
                'authenticatorAttachment': "platform",
                'requireResidentKey': True,
                'residentKey': 'required',
                'userVerification': "preferred",  # optional as preferred is the default
            },
        }

    def save_passkey_credential(self, credential, ex_options):
        self.ensure_one()
        # print(credential, ex_options)
        registration_verification = verify_registration_response(
            credential=credential,
            expected_challenge=base64.b64decode(ex_options.get('challenge')),
            expected_rp_id=ex_options.get('rp_id'),
            expected_origin='https://' + ex_options.get('rp_id'),
            require_user_verification=True)

        # print(registration_verification)
        c = self.env['public.key.credential'].sudo().create({
            'user_id': self.id,
            'key': bytes_to_base64url(registration_verification.credential_id),
            'ctype': credential.get('type'),
            'auth_attachment': credential.get('authenticatorAttachment'),  # string eg. 'platform'
            'public_key': bytes_to_base64url(registration_verification.credential_public_key),
            # 'key': credential.get('id'),
            # 'client_extension_results: credentials.get('clientExtensionResults'),  # empty dict
            # 'raw_id': credentials.get('rawId'),  # string ArrayBuffer? seems equal to 'id'
            # 'data': base64.b64decode(credential.get('response')['clientDataJSON']),  # string ArrayBuffer?
            # 'attestation': base64.b64decode(credential.get('response')['attestationObject']),  # string ArrayBuffer
            # 'authenticator_data': base64.b64decode(credential.get('response')['authenticatorData']), # string ArrayBuffer?
            # 'public_key': credential.get('response')['publicKey'],  # string
            # 'transports': credential.get('response')['transports'],  # this is a list eg. ['internal']
            # 'algorithm': credential.get('response')['publicKeyAlgorithm'],  # Integer eg. -7

        })
        return c

    def _check_credentials(self, password, env):
        try:
            return super()._check_credentials(password, env)
        except AccessDenied:
            passwd_allowed = env['interactive'] or not self.env.user._rpc_api_keys_only()
            if passwd_allowed and self.env.user.active:
                cred_user = self.env['public.key.credential'].search([('key', '=', password)]).user_id
                print('WTF! Is this even useful?')
                res = self == cred_user
                if res:
                    return
            raise
