# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from collections import defaultdict
import logging

from odoo import api, fields, models

_logger = logging.getLogger(__name__)


class ProductHSCode(models.Model):
    _name = "product.hs.code"
    _description = "Product HS Code"
    _order = "code asc"

    code = fields.Char('Code', required=True)
    description = fields.Char('Description')
    level = fields.Selection({
        2: 'Chapter',
        4: 'Heading',
        6: 'Subheading',
        8: 'Regional Tariff',
        10: 'Country Tariff',
    }, compute='_compute_level')
    authority = fields.Char('Authority')
    parent_id = fields.Many2one(
        'product.hs.code',
        compute='_compute_parent_id'
    )
    start_date = fields.Date(string='Date from', help='Date from which a code can be used.')
    expiry_date = fields.Date(string='Date expiry', help='Date at which a code must not be used anymore.')

    @api.depends('code')
    def _compute_level(self):
        for hs_code in self:
            hs_code.level = len(hs_code.code)

    @api.depends('code')
    def _compute_parent_id(self):
        parent_ids = defaultdict(list)
        for hs_code in self:
            parent_ids[(hs_code.code[:-2], hs_code.authority)].append(hs_code)
        for code, authority in parent_ids:
            parent_id = self.search([('code', '=', code), ('authority', '=', authority)], limit=1)
            for child in parent_ids[(code, authority)]:
                child.parent_id = parent_id
