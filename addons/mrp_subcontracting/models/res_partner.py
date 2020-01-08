# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class ResPartner(models.Model):
    _inherit = 'res.partner'

    property_stock_subcontractor = fields.Many2one(
        'stock.location', string="Subcontractor Location", company_dependent=True,
        help="The stock location used as source and destination when sending\
        goods to this contact during a subcontracting process.")
    is_subcontractor = fields.Boolean(string="Subcontractor",
        compute="_compute_is_subcontractor", search="_search_is_subcontractor")

    def _compute_is_subcontractor(self):
        subcontractor_ids = self.env['mrp.bom'].search(
                                [('type', '=', 'subcontract')]).subcontractor_ids.ids
        for record in self:
            if record.id in subcontractor_ids:
                record.is_subcontractor = True
            else:
                record.is_subcontractor = False

    def _search_is_subcontractor(self, operator, value):
        subcontractor_ids = self.env['mrp.bom'].search(
                                [('type', '=', 'subcontract')]).subcontractor_ids.ids
        if (operator, value) == ('=', True):
            return [('id', 'in', subcontractor_ids)]

