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

class pos_config(models.Model):
    _inherit = 'pos.config'

    iface_blackbox_be = fields.Boolean("Belgian Fiscal Data Module", help="Enables integration with a Belgian Fiscal Data Module")

class res_users(models.Model):
    _inherit = 'res.users'

    # bis number is for foreigners in Belgium
    insz_or_bis_number = fields.Char("INSZ or BIS number",
                                     help="Social security identification number") # todo jov: enforce length of 11

class pos_order(models.Model):
    _inherit = 'pos.order'

    # todo jov: add the things that will be coming back from the FDM as fields
