# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import hashlib
from openerp import models, fields, api

class pos_order(models.Model):
    _inherit = 'pos.order'

    def calculate_hash(self):
        orders_string = ""

        sha1 = hashlib.sha1(orders_string).hexdigest()
        return sha1
