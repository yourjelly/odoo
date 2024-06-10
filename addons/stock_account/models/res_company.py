# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class Company(models.Model):
    _inherit = 'res.company'
    _check_company_auto = True

    automatic_accounting = fields.Boolean(default=False)
