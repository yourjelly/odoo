# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models
from odoo.addons import account


class ResCompany(account.ResCompany):

    vat_check_vies = fields.Boolean(string='Verify VAT Numbers')
