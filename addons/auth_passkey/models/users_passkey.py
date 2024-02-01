from odoo import fields, models, api, _
from odoo.addons.base.models.res_users import check_identity
from odoo.exceptions import AccessDenied

class UsersPasskey(models.Model):
    _inherit = "res.users"

    auth_passkey_key_ids = fields.One2many("auth.passkey.key", "create_uid")
    password_login_disabled = fields.Boolean(string="Password Disabled",
                                            compute="_compute_password_login_disabled",
                                            readonly=True,
                                            help="Only allow users to login via Passkeys.")
    allow_password_delete = fields.Boolean(compute="_compute_allow_password_delete")
    invalidation_counter = fields.Integer(default=0)

    @property
    def SELF_WRITEABLE_FIELDS(self):
        return super().SELF_WRITEABLE_FIELDS + ['auth_passkey_key_ids']

    @property
    def SELF_READABLE_FIELDS(self):
        return super().SELF_READABLE_FIELDS + ['auth_passkey_key_ids']
    
    def _get_session_token_fields(self):
        return super()._get_session_token_fields() | {'invalidation_counter'}

    def _check_credentials(self, password, env):
        if self.env['res.users.apikeys']._check_credentials(scope='rpc', key=password) == self.env.uid:
            return
        if self.env.user.password_login_disabled:
            raise AccessDenied()
        return super()._check_credentials(password, env)
    
    @check_identity
    def action_create_passkey(self):
        return {
            'name': _('Create Passkey'),
            'type': 'ir.actions.act_window',
            'res_model': 'auth.passkey.key',
            'view_id': self.env.ref('auth_passkey.auth_passkey_key_create').id,
            'view_mode': 'form',
            'target': 'new',
            'context': {
                'dialog_size': 'medium',
            }
        }
    
    @check_identity
    def action_delete_password_self(self):
        return {
            'name': _('Delete Password'),
            'type': 'ir.actions.act_window',
            'target': 'new',
            'res_model': 'res.users',
            'res_id': self.id,
            'view_mode': 'form',
            'view_id': self.env.ref('auth_passkey.res_users_delete_password_self').id,
        }
    
    @check_identity
    def action_delete_password_other(self):
        return {
            'name': _('Delete Password'),
            'type': 'ir.actions.act_window',
            'target': 'new',
            'res_model': 'res.users',
            'res_id': self.id,
            'view_mode': 'form',
            'view_id': self.env.ref('auth_passkey.res_users_delete_password_other').id,
        }
    
    @check_identity
    def delete_password(self):
        for user in self:
            if user.id == self.env.user.id:
                if not self.env['ir.config_parameter'].sudo().get_param("auth_passkey.allow_delete_password"):
                    try:
                        # check access rights
                        user.password = ''
                    except:
                        raise AccessDenied(_("You are not allowed to delete your own password."))
            else:
                # check access rights
                user.password = ''
            self.env.cr.execute("UPDATE res_users SET password='' WHERE id=%s", (user.id,))
    
    def _compute_password_login_disabled(self):
        # Password is disabled when set to ''
        for user in self:
            self.env.cr.execute(
                "SELECT COALESCE(password, '') FROM res_users WHERE id=%s",
                [user.id]
            )
            [hashed] = self.env.cr.fetchone()
            valid, replacement = user._crypt_context()\
                .verify_and_update('', hashed)
            if replacement is not None:
                self._set_encrypted_password(user.id, replacement)
            user.password_login_disabled = valid

    def _compute_allow_password_delete(self):
        allowed = self.env['ir.config_parameter'].sudo().get_param("auth_passkey.allow_delete_password")
        for user in self:
            user.allow_password_delete = allowed
