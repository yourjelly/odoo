# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api, _
from odoo.exceptions import ValidationError

class AccountJournal(models.Model):
    _inherit = "account.journal"

    @api.model
    def _enable_electronic_payment_on_bank_journals(self):
        """ Enables electronic payment method and add a check sequence on bank journals.
            Called upon module installation via data file.
        """
        electronic = self.env.ref('payment.account_payment_method_electronic')
        bank_journals = self.search([('type', '=', 'bank')])
        if bank_journals:
            bank_journals.write({'inbound_payment_method_ids': [(4, electronic.id, None)]})
