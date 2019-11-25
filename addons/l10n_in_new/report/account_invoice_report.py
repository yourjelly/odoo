# -*- coding: utf-8 -*-

from odoo import api, fields, models, tools

class L10nInAccountInvoiceReport(models.Model):
    _inherit = "l10n_in.account.invoice.report"

    l10n_in_gst_treatment = fields.Selection([
        ('regular','Registered Business - Regular'),
        ('composition','Registered Business - Composition'),
        ('unregistered','Unregistered Business'),
        ('consumer','Consumer'),
        ('overseas','Overseas'),
        ('special_economic_zone','Special Economic Zone'),
        ('deemed_export','Deemed Export'),
        ],string="GST Treatment")
