# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.


from odoo import models, fields


class AccountJournal(models.Model):
    _inherit = 'account.journal'

    l10n_eg_branch_id = fields.Many2one('res.partner', string='Branch', copy=False)
