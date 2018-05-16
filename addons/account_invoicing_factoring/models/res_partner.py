# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api


class ResPartner(models.Model):
    _inherit = 'res.partner'

    finexkap_uuid = fields.Char('Partner UUID', readonly=True, help='Finexkap Debtor UUID')
    finexkap_status = fields.Selection([
        ('Unknown', 'Unknown'),
        ('New', 'New'),
        ('Accepted', 'Accepted'),
        ('Rejected', 'Rejected'),
        ('Pending', 'Pending')
    ], string='Financing Status', default='Unknown')

    @api.multi
    def action_request_financing_debtor(self):
        self.ensure_one()
        if self.company_type == 'company':
            return self.env['factoring.api']._send_debtors([self])
        return False
