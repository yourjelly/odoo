# -*- coding:utf-8 -*-

from odoo import _, fields, models


class AccountJournal(models.Model):
    _inherit = 'account.journal'

    def l10n_pl_edi_ksef_get_new_documents(self):
        self.env['account.move']._l10n_pl_edi_get_new_documents()

    def l10n_pl_edi_get_status(self):
        self.env['account.move']._l10n_pl_edi_get_status()
