# -*- coding: utf-8 -*-
from odoo import api, models, _
from odoo.exceptions import UserError
from odoo.tools import consteq

import logging
from hashlib import sha1
import requests

_logger = logging.getLogger(__name__)


class ResUsers(models.Model):
    _inherit = 'res.users'

    @api.model
    def get_password_policy(self):
        params = self.env['ir.config_parameter'].sudo()
        return {
            'minlength': int(params.get_param('auth_password_policy.minlength', default=0)),
        }

    def _set_password(self):
        self._check_password_policy(self.mapped('password'))

        super(ResUsers, self)._set_password()

    def _verify_password_haveibeenpwned(self, password):
        hashdigest = sha1(password.encode()).hexdigest()
        prefix, suffix = hashdigest[:5], hashdigest[5:].upper()
        req = requests.get(f"https://api.pwnedpasswords.com/range/{prefix}", timeout=2)
        if req.status_code == 429:
            res = req.json()
            _logger.error("Could not reach pwnedpasswords.com, %s", res.get("message", "API rate limit reached"))
        for line in req.text.split("\r\n"):
            if consteq(line.split(":")[0], suffix):
                return False
        return True

    def _check_password_policy(self, passwords):
        failures = []
        params = self.env['ir.config_parameter'].sudo()

        minlength = int(params.get_param('auth_password_policy.minlength', default=0))
        haveibeenpwned = bool(params.get_param('auth_password_policy.haveibeenpwned', default=False))
        for password in passwords:
            if not password:
                continue
            if len(password) < minlength:
                failures.append(_(u"Passwords must have at least %d characters, got %d.") % (minlength, len(password)))
            if haveibeenpwned:
                if not self._verify_password_haveibeenpwned(password):
                    failures.append(_("Password appears in a data breach, choose another one."))

        if failures:
            raise UserError(u'\n\n '.join(failures))
