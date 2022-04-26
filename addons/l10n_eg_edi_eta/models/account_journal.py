# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.


from odoo import models, fields


class AccountJournal(models.Model):
    _inherit = 'account.journal'

    l10n_eg_branch_id = fields.Many2one('res.partner', string='Branch', copy=False)
    l10n_eg_activity_type_id = fields.Many2one('l10n_eg_edi.activity.type', 'ETA Activity Code', copy=False,
                                               help='This is the activity type of partner according to egyptian tax authority')
    l10n_eg_branch_identifier = fields.Char('ETA Branch ID', copy=False)
