from odoo import fields, models
from odoo.exceptions import AccessDenied


class NoPasswordLogin(models.Model):
    _inherit = 'res.users'

    restrict_password = fields.Boolean()

    def _check_credentials(self, credential, env):
        login_info = super()._check_credentials(credential, env)
        if login_info['auth_method'] == 'password':
            if self.restrict_password:
                raise AccessDenied
        return login_info
