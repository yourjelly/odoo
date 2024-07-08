# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import _, api, fields, models
from odoo.exceptions import ValidationError


class ResCompany(models.Model):
    _inherit = 'res.company'
    _check_company_auto = True

    stock_accounting_automatic = fields.Boolean(string="Stock Accounting Automatic", default=True)
