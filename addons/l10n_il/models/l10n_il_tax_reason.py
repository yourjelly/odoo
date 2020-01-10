# -*- coding: utf-8 -*-

from odoo import fields, models


class WithhReason(models.Model):
    _name = 'l10n.il.tax.reason'

    name = fields.Char(string='Withh Tax Reason')
    code = fields.Char(string='Code for Withh Tax Reason')

    _sql_constraints = [('code_name_uniq', 'unique (code,name)', 'The code of the Withholding Tax Reason must be unique!')]
