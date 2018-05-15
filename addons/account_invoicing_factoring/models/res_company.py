# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api


class ResCompany(models.Model):
    _inherit = 'res.company'

    finexkap_username = fields.Char('Username')
    finexkap_password = fields.Char('Password')
    finexkap_account_status = fields.Char('Account status', default='Unknown')

    @api.multi
    def save_factoring_settings(self):
        self.ensure_one()
        if self.finexkap_username and self.finexkap_password and self.siret:
            self.env['factoring.api']._update_credentials(self, self.finexkap_username, self.finexkap_password)
