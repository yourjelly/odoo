import time
import base64

from odoo import api, fields, models, _
from odoo.http import request
from odoo.exceptions import AccessError

class PassKey(models.Model):
    _name = "auth.passkey.key"
    _description = "Passkeys"
    _order = "id desc"

    name = fields.Char(required=True)
    credential_identifier = fields.Char(required=True, groups='base.group_system')
    public_key = fields.Char(required=True, groups='base.group_system')
    sign_count = fields.Integer(default=0, groups='base.group_system')

    def _get_user_by_credential_id(self, id):
        id = base64.urlsafe_b64decode(id).hex()
        results = self.sudo().search([("credential_identifier", "=", id)])
        if len(results) == 1:
            return results[0]
        return False
    
    @api.model
    def action_new_passkey(self, key):
        if request.session.get('identity-check-last', 0) > time.time() - 10 * 60:
            self.sudo().create({
                'name': key['name'],
                'credential_identifier': base64.urlsafe_b64decode(key['credential_identifier']).hex(),
                'public_key': key['public_key'],
            })
        else:
            raise AccessError(_("Your session expired, please try again."))


    def action_rename_passkey(self):
        return {
            'name': _('Rename Passkey'),
            'type': 'ir.actions.act_window',
            'res_model': 'auth.passkey.key',
            'view_id': self.env.ref('auth_passkey.auth_passkey_key_rename').id,
            'view_mode': 'form',
            'target': 'new',
            'res_id': self.id,
            'context': {
                'dialog_size': 'medium',
            }
        }
