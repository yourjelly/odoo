# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import logging

from odoo import models
from odoo.tools import populate

_logger = logging.getLogger(__name__)


class ProductCategory(models.Model):
    _inherit = "product.category"
    _populate_database_scales = {"low": 50, "medium": 500, "high": 30000}

    def _populate_factories(self):
        def get_name(values=None, counter=0, complete=False, **kwargs):
            return "%s_%s_%s" % ("product_category", int(complete), counter)

        # quid of parent_id ???

        return [("name", populate.compute(get_name))]


class ProductProduct(models.Model):
    _inherit = "product.product"
    _populate_database_scales = {"low": 150, "medium": 5000, "high": 60000}

    def _populate_factories(self):

        return [
            ("name", populate.get_string('product_template_name')),
            ("sequence", populate.randomize([False] + [i for i in range(1, 101)])),
            ("description", populate.get_string('product_template_description')),
            ("default_code", populate.get_string('product_default_code')),
            ("active", populate.randomize([True, False], [0.8, 0.2])),
        ]
