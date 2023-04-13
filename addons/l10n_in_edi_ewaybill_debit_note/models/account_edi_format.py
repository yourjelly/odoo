# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import models


class AccountEdiFormat(models.Model):
    _inherit = "account.edi.format"

    def _l10n_in_edi_ewaybill_base_irn_or_direct(self, move):
        """
            In case of a debit note, we use the direct method as per government rules.
        """
        if move.debit_origin_id:
            return "direct"
        return super()._l10n_in_edi_ewaybill_base_irn_or_direct(move)
