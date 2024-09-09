# Part of Odoo. See LICENSE file for full copyright and licensing details.

from random import randint
from odoo import models
from odoo.tools.duplicate import vary_string_field
from odoo.tools.sql import SQL

class ResPartner(models.Model):
    _inherit = 'res.partner'

    def _duplicate_field_need_variation(self, field, **kwargs):
        if field.name == 'name':
            return True
        return super()._duplicate_field_need_variation(field, **kwargs)

    def _duplicate_variate_field(self, field, **kwargs):
        if field.name == 'name':
            first_name = vary_string_field(randint(4, 10))
            last_name = vary_string_field(randint(5, 11))
            return SQL('''%s || ' ' ||  %s''', first_name, last_name)
        return super()._duplicate_variate_field(field, **kwargs)
