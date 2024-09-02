# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, api
from odoo.tools.sql import SQL
from odoo.tools.duplicate import fetch_last_id


class StockPicking(models.Model):
    _inherit = 'stock.picking'

    def field_need_variation(self, field):
        if field.name == 'name':
            return True
        return super().field_need_variation(field)

    def variate_field(self, field):
        if field.name == 'name':
            return SQL(r'''regexp_replace(name, '(.*\/)\d*', '\1') || '0' || (%s + row_number() OVER ())''', fetch_last_id(self.env, self))
