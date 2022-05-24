from odoo import api, fields, models, _


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    minlength = fields.Integer(
        "Minimum Password Length", config_parameter="auth_password_policy.minlength", default=0,
        help="Minimum number of characters passwords must contain, set to 0 to disable.")

    haveibeenpwned = fields.Boolean(
        "Verify if Password Vulnerable", config_parameter="auth_password_policy.haveibeenpwned",
        help="Verify the password on a database of leaked password and warn the user.")

    @api.onchange('minlength')
    def _on_change_mins(self):
        """ Password lower bounds must be naturals
        """
        self.minlength = max(0, self.minlength or 0)
