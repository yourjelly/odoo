# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class AccountBankStatementLine(models.Model):
    _inherit = "account.bank.statement.line"

    def _prepare_reconciliation_move(self, move_ref):
        pos_config = self.statement_id.pos_session_id.config_id
        res = super(AccountBankStatementLine, self)._prepare_reconciliation_move(move_ref)
        res.update({
            'l10n_in_gstin_partner_id': pos_config.l10n_in_gstin_partner_id.id,
            'l10n_in_place_of_supply': pos_config.l10n_in_place_of_supply.id
        })
        return res

    def _prepare_payment_vals(self, total):
        vals = super(AccountBankStatementLine, self)._prepare_payment_vals(total)
        pos_config = self.statement_id.pos_session_id.config_id
        vals.update({
            'l10n_in_gstin_partner_id': pos_config.l10n_in_gstin_partner_id.id,
            'l10n_in_place_of_supply': pos_config.l10n_in_place_of_supply.id
        })
        return vals
