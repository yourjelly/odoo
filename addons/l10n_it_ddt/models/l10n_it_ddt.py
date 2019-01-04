# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields


class L10nItDdt(models.Model):
    _name = 'l10n.it.ddt'

    name = fields.Char('DDT Number', default=lambda self: self.env['ir.sequence'].next_by_code('l10n.it.ddt'),
    required=True, help="Unique DDT Number")
    date = fields.Datetime(string='Creation Date', opy=False)
    orgin = fields.Char(string="Source Documents")
    date_done = fields.Datetime(tring='Shipping Date')
    package_no = fields.Integer(string="No of Package")
    transfers_reason = fields.Selection([('sale', 'sale'), ('Good For Repair', 'repair')], string='Reasone Of Transfers')
    company_id = fields.Many2one('res.company', string='Company')
    package_id = fields.Many2one('stock.quant.package', string='package')
    weight = fields.Float(string="weight")
    volume = fields.Float(string="Volume")
    quantity = fields.Integer(string="quantity")
