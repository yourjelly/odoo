# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.exceptions import Warning as UserError


class StockPicking(models.Model):
    _inherit = "stock.picking"

    ddt_id = fields.Many2one('l10n.it.ddt', String='Transport Document')
    @api.constrains('ddt_id')
    def _check_ddt_id(self):
        for picking in self:
            if picking.partner_id != ddt.partner_id or picking.warehouse_id != ddt.warehouse_id or :
                raise ValidationError(_('You can not link ddt with different partner, warehouse and picking type.'))

class Stock_Move(models.Model):
    _name = 'stock.move'
    _inherit = 'stock.move'

    unit_price = fields.Float(string='Unit Price', related='sale_line_id.price_unit')
    discount = fields.Float(string='Discount', related='sale_line_id.discount')
    tax_ids = fields.Many2many('account.tax', string='Taxes', related='sale_line_id.tax_id')
    total_amount = fields.Float(computed='_compute_total_amount')
