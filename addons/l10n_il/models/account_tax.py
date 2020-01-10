# -*- coding: utf-8 -*-

from odoo import fields, models


class WithhTaxReportData(models.Model):
    _inherit = 'account.tax'

    l10n_il_tax_reason = fields.Many2one('l10n.il.tax.reason', string='Tax Reason', help="This field contains the withholding tax reason that will be used for Annual Witholding Tax Report'")
