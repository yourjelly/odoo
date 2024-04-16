# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models
from odoo.tools import populate


class ProductProduct(models.Model):
    _inherit = 'product.product'

    def _populate_factories(self):

        def get_tracking(values, counter, random):
            if values['type'] == 'consu' and values['is_trackable']:
                return random.choices(['none', 'lot', 'serial'], [0.7, 0.2, 0.1])[0]
            else:
                return 'none'

        return super()._populate_factories() + [
            ('tracking', populate.compute(get_tracking))
        ]
