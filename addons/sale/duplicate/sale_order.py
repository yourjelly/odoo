# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models
from odoo.tools.duplicate import fetch_last_id
from odoo.tools.sql import SQL

class SaleOrder(models.Model):
    _inherit = 'sale.order'

    def _duplicate_field_need_variation(self, field, **kwargs):
        if field.name == 'name':
            return True
        return super()._duplicate_field_need_variation(field, **kwargs)

    def _duplicate_variate_field(self, field, **kwargs):
        if field.name == 'name':
            seq = self.env['ir.sequence'].with_company(self.env.company).search([('code', '=', 'sale.order')])
            padding = (seq and seq.padding) or 5
            return SQL(''' 'S' || LPAD((%(last_id)s + row_number() OVER())::text, GREATEST(LENGTH((%(last_id)s + row_number() OVER())::text), %(padding)s), '0')''',
                       last_id=fetch_last_id(self.env, self),
                       padding=padding)
        return super()._duplicate_variate_field(field, **kwargs)
