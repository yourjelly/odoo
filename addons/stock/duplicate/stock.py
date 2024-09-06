# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, api
from odoo.tools.sql import SQL
from odoo.tools.duplicate import fetch_last_id


class StockPicking(models.Model):
    _inherit = 'stock.picking'

    def _duplicate_field_need_variation(self, field):
        if field.name == 'name':
            return True
        return super()._duplicate_field_need_variation(field)

    def _duplicate_variate_field(self, field):
        if field.name == 'name':
            seq = self.env['ir.sequence'].with_company(self.env.company).search([('code', '=', 'stock.picking')])
            padding = (seq and seq.padding) or 5
            return SQL(rf"regexp_replace(name, '(.*\/)\d*', '\1') || TO_CHAR(%s + row_number() OVER (), 'fm{'0' * padding}')",
                       fetch_last_id(self.env, self))
        return super()._duplicate_variate_field(field)

    def _duplicate_follow_related_store(self, field):
        if field.name == 'sale_id':
            return True
        return super()._duplicate_follow_related_store(field)
