# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import fields, models
from odoo.addons import account


class AccountTax(account.AccountTax):


    l10n_uy_tax_category = fields.Selection([
        ('vat', 'VAT'),
    ], string="Tax Category", help="UY: Use to group the transactions in the Financial Reports required by DGI")
