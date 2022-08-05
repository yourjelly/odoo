# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models
from odoo.addons.account_edi_ubl_cii.models.account_edi_format import FORMAT_CODES


class AccountMove(models.Model):
    _inherit = 'account.move'

    def _edi_post_move_hook(self, edi_format):
        if edi_format.code not in FORMAT_CODES:
            return super()._edi_post_move_hook(edi_format)
        edi_format._post_invoice_edi(self)
