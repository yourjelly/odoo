from odoo import fields, models

class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    auth_passkey_reset_enabled = fields.Boolean(
        string='Allow users to re-enable their login via password by resetting their password',
        config_parameter='auth_passkey.reset_password_disabled')

    auth_passkey_allow_delete_password = fields.Boolean(
        string='Allow users to delete their own password',
        config_parameter='auth_passkey.allow_delete_password')
