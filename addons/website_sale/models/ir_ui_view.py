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
