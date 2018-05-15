# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api, _
from odoo.exceptions import UserError


class ResPartner(models.Model):
    _inherit = 'res.partner'

    finexkap_uuid = fields.Char('Partner UUID', readonly=True, help='Finexkap Debtor UUID')
    finexkap_status = fields.Char('Financing Status', default='Unknown')

    @api.multi
    def action_request_financing_debtor(self):
        self.ensure_one()
        if self.company_type == 'company':
            return self.env['factoring.api']._send_debtors([self])
        return False


class ResPartnerFinancing(models.TransientModel):
    _name = 'res.partner.financing.request'

    partner_ids = fields.Many2many('res.partner', string='Partners')

    @api.model
    def default_get(self, fields):
        """ Default get for valid invoices and ignored invoices"""
        result = super(ResPartnerFinancing, self).default_get(fields)

        if self.env.user.company_id.finexkap_account_status != 'Accepted':
            raise UserError(_('Your Finaxkap account is not activated yet.'))

        active_ids = self._context.get('active_ids', [])
        partners = self.env['res.partner'].browse(active_ids)
        valid_partners = partners.filtered(lambda partner: partner.siret and partner.company_type == 'company')
        if not valid_partners:
            raise UserError(_("No valid partner found"))
        result['partner_ids'] = list(valid_partners.ids)
        return result

    @api.multi
    def action_enable_financing(self):
        partners = self.partner_ids.filtered(lambda p: p.company_type == 'company')
        return self.env['factoring.api']._send_debtors(partners)
