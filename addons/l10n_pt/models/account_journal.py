# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, api


class AccountMove(models.Model):
    _inherit = 'account.journal'

    def _compute_restrict_mode_hash_table(self):
        super()._compute_restrict_mode_hash_table()
        for move in self:
            if move.company_id.country_id.code == 'PT':
                move.restrict_mode_hash_table = True
                move.write({'restrict_mode_hash_table': True})
