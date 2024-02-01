import time
import json

from odoo import fields
from odoo.http import request
from odoo.addons.base.models.res_users import CheckIdentity

class CheckIdentityPasskeys(CheckIdentity):
    _inherit = 'res.users.identitycheck'

    hide_button = fields.Selection([('none','None'),
                                    ('passkey', 'Passkey')],
                                    compute='_compute_hide_button',
                                    store=False)

    def _bypass(self):
        assert request, "This method can only be accessed over HTTP"
        self.password = False

        request.session['identity-check-last'] = time.time()
        ctx, model, ids, method = json.loads(self.sudo().request)
        method = getattr(self.env(context=ctx)[model].browse(ids), method)
        assert getattr(method, '__has_check_identity', False)
        return method()

    def revoke_all_devices(self):
        self.env.user.sudo().invalidation_counter += 1
        self.env.user.invalidate_recordset(['invalidation_counter'])
        self.sudo().unlink()
        return {'type': 'ir.actions.client', 'tag': 'reload'}
    
    def _compute_hide_button(self):
        self.hide_button = 'none'
        if len(self.create_uid.auth_passkey_key_ids) == 0:
            self.hide_button = 'passkey'
