# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api, _


class ResPartner(models.Model):
    _inherit = 'res.partner'

    finexkap_uuid = fields.Char('Partner UUID', readonly=True, help='Finexkap Debtor UUID')
    finexkap_status = fields.Char('Status', default='Unknown')

    @api.multi
    def action_request_financing_debtor(self):
        self.ensure_one()
        if self.company_type == 'company':
            self.env['factoring.api']._send_debtors([self])
            return True
        return False
