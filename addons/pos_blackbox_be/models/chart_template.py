# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from openerp import models, fields, api

from openerp.exceptions import UserError
from openerp.tools.translate import _

class AccountTax(models.Model):
    _inherit = 'account.tax'

    identification_letter = fields.Selection([('A', 'A'), ('B', 'B'), ('C', 'C'), ('D', 'D')], default=lambda self: self.default_identification_letter())

    def default_identification_letter(self):
        if self.amount_type == "percent" or self.amount_type == "group":
            if self.amount == 21:
                return "A"
            elif self.amount == 12:
                return "B"
            elif self.amount == 8:
                return "C"
            elif self.amount == 0:
                return "D"
            else:
                raise UserError(_("Can't determine the tax type required for the Fiscal Data Module. Only 21%, 12%, 8% and 0% are allowed."))
        else:
            return False
