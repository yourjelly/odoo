# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from logging import getLogger
from odoo import fields, models

_logger = getLogger(__name__)


class IrAsset(models.Model):

    _inherit = 'ir.asset'

    def _get_asset_domain(self, bundle):
        domain = super(IrAsset, self)._get_asset_domain()
        website_id = self.env.context.get('website_id', False)
        if website_id:
            domain += [('website_id', '=', website_id)]
        return domain

    website_id = fields.Many2one('website')
