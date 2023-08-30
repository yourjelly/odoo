# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging

from odoo import api, models

_logger = logging.getLogger(__name__)


class View(models.Model):

    _inherit = ["ir.ui.view"]

    @api.model
    def _prepare_new_page_template_context(self, context):
        super()._prepare_new_page_template_context(context)
        # Populate with s_products required data
        dynamic_filter = self.env.ref('website_sale.dynamic_filter_newest_products')
        context['website_sale_records'] = dynamic_filter._prepare_sample()
        context['website_sale_filter_id'] = dynamic_filter.id
