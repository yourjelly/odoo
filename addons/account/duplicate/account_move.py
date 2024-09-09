# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models
from odoo.tools.duplicate import vary_date_field, fetch_last_id
from odoo.tools.sql import SQL

class AccountMove(models.Model):
    _inherit = 'account.move'

    def _duplicate_field_need_variation(self, field, **kwargs):
        if field.name == 'name':
            return True
        return super()._duplicate_field_need_variation(field)

    def _duplicate_variate_field(self, field, factors, **kwargs):
        if field.name == 'name':
            date = vary_date_field(self.env, self, factors)
            last_id = fetch_last_id(self.env, self)
            return SQL(
                r"""CASE WHEN name='/' THEN '/' ELSE regexp_replace(name, '(\w+\/).*', '\1') ||
                    EXTRACT('year' FROM %(date)s) ||
                    '/' ||
                    CASE WHEN name ~ '.*(\/\d\d\/).*' THEN LPAD(EXTRACT('month' FROM %(date)s)::text, 2, '0') ||
                    '/' ELSE '' END ||
                    %(last_id)s + row_number() OVER() END""",
                date=date,
                last_id=last_id,
            )
        return super()._duplicate_variate_field(field)
