# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    group_l10n_in_reseller = fields.Boolean(implied_group='l10n_in.group_l10n_in_reseller', 
    	string="Manage Reseller(E-Commerce)")
    module_l10n_in_einvoice = fields.Boolean(string='e-Invoice System', 
    	help='Upload Invoices to Invoice Registration Portal (IRP), managed by the GST Network(GSTN)')
