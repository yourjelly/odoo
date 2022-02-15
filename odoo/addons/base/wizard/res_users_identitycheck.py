import json
import time
from odoo import fields, models, _
from odoo.exceptions import AccessDenied, UserError
from odoo.http import request


class CheckIdentity(models.TransientModel):
    """ Wizard used to re-check the user's credentials (password)

    Might be useful before the more security-sensitive operations, users might be
    leaving their computer unlocked & unattended. Re-checking credentials mitigates
    some of the risk of a third party using such an unattended device to manipulate
    the account.
    """
    _name = 'res.users.identitycheck'
    _description = "Password Check Wizard"

    request = fields.Char(readonly=True, groups=fields.NO_ACCESS)
    password = fields.Char()

    def run_check(self):
        assert request, "This method can only be accessed over HTTP"
        try:
            self.create_uid._check_credentials(self.password, {'interactive': True})
        except AccessDenied:
            raise UserError(_("Incorrect Password, try again or click on Forgot Password to reset your password."))

        self.password = False

        request.session['identity-check-last'] = time.time()
        ctx, model, ids, method = json.loads(self.sudo().request)
        return getattr(self.env(context=ctx)[model].browse(ids), method)()
