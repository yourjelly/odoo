# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.


from odoo import models, fields, api


class ProductTemplate(models.Model):
    _inherit = 'product.template'

    l10n_eg_item_type = fields.Selection([('GS1', 'GS1'), ('EGS', 'EGS')], string='ETA Item Type',
                                         help='The type of item according to egyptian tax authority and default is GS1',
                                         default='GS1')
    l10n_eg_item_code = fields.Char(string='ETA Item Code',
                                    help='This is the code of item according to egyptian tax authority')
