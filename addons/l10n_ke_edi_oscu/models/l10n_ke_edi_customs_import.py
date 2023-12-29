# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import logging

from odoo import api, fields, models

class L10nKeEdiCustomsImport(models.Model):
    _name = 'l10n_ke_edi.customs.import'

    name = fields.Text('Information')
    product_id = fields.Many2one('product.product')
    company_id = fields.Many2one('res.company')