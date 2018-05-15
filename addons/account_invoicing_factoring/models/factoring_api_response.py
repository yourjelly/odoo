# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api, _


class DebtorRequestResponse(models.TransientModel):
    _name = 'debtor.request.response'

    request_ids = fields.Many2many('debtor.request.line', string='Customers')

    @api.model
    def default_get(self, fields):
        result = super(DebtorRequestResponse, self).default_get(fields)
        partners = self._context.get('partners', [])
        request_line_ids = []
        for partner in partners:
            request_line_ids.append(self.env['debtor.request.line'].create({
                'partner_name': partner.get('name'),
                'siret': partner.get('siret'),
                'state': 'fail',
                'reason': partner.get('errorMessage')
            }).id)
        result['request_ids'] = request_line_ids
        return result


class DebtorRequestLine(models.TransientModel):
    _name = 'debtor.request.line'

    partner_name = fields.Char('Name')
    siret = fields.Char('Siret')
    state = fields.Selection([('success', 'Success'), ('fail', 'Failed')], default='success')
    reason = fields.Char('Reason')
