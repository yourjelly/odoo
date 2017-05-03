# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import datetime
from dateutil.relativedelta import relativedelta

from odoo import api, fields, models

from odoo.tools.float_utils import float_round, float_compare

import logging
_logger = logging.getLogger(__name__)#TODO OCO DEBUG

class FinancialYearOpeningWizard(models.TransientModel):
    _name = 'accountant.financial.year.op'

    def _default_opening_date(self):
        today = datetime.now()
        return today + relativedelta(day=1, hour=0, minute=0, second=0, microsecond=0)

    company_id = fields.Many2one(comodel_name='res.company')
    opening_date = fields.Date(required=True,default=_default_opening_date, related='company_id.account_accountant_opening_date')
    fiscalyear_last_day = fields.Integer(related="company_id.fiscalyear_last_day", required=True)
    fiscalyear_last_month = fields.Selection(selection=[(1, 'January'), (2, 'February'), (3, 'March'), (4, 'April'), (5, 'May'), (6, 'June'), (7, 'July'), (8, 'August'), (9, 'September'), (10, 'October'), (11, 'November'), (12, 'December')],
                                             related="company_id.fiscalyear_last_month",
                                             required=True)

    #TODO OCO : "2 lines of explanation that you don’t need to open / close fiscal years" :> C'est-à-dire ?

class OpeningAccountMoveWizard(models.TransientModel):
    _name = 'accountant.opening'

    company_id = fields.Many2one(comodel_name='res.company')

    #TODO OCO : tu peux simplifier et faire disparaître ce champ, non ?
    opening_move_id = fields.Many2one(string='Opening move', comodel_name='account.move', related='company_id.account_accountant_opening_move')

    currency_id = fields.Many2one(comodel_name='res.currency', related='opening_move_id.currency_id')

    opening_move_line_ids = fields.One2many(string='Opening move lines', related="opening_move_id.line_ids")
    journal_id = fields.Many2one(string='Journal', comodel_name='account.journal', required=True, related='opening_move_id.journal_id')
    date = fields.Date(string='Opening date', required=True, related='opening_move_id.date')

    adjustment_account_id = fields.Many2one(string="Adjustment account", required=True, related='company_id.account_accountant_opening_adjustment_account', help="The account into which the adjustment difference for this move will be posted.")
    #TODO OCO à la validation du wizard, il faudra donc manuellement assigner le champ qui se trouve sur res_company

    def get_adjustment_difference(self):
        for record in self:
            sum_debit = 0.0
            sum_credit = 0.0

            for move_line in record.opening_move_line_ids:
                # each line has either debit or credit set, and the other to 0.0
                sum_debit += move_line.debit
                sum_credit += move_line.credit

            greatest = float_compare(sum_debit, sum_credit, precision_rounding=record.currency_id.rounding)==-1 and 'credit' or 'debit'
            value = float_round(abs(sum_debit-sum_credit), precision_rounding=record.currency_id.rounding)

            return (greatest, value)

    def validate(self):
        (method, value) = self.get_adjustment_difference()

        if value:
            self.env['account.move.line'].create({
                'name': "Opening adjustment difference",
                method: value,
                'move_id': self.opening_move_id.id,
                'account_id': self.adjustment_account_id.id,
            })

        self.opening_move_id.post()

        self.company_id.account_accountant_opening_move_adjustment = value
        self.company_id.account_accountant_setup_opening_move_done = True
