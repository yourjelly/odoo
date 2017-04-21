# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import datetime
from dateutil.relativedelta import relativedelta

from odoo import api, fields, models

class FinancialYearOpeningWizard(models.TransientModel):
    _name = 'account.accountant.financial.year.op.wizard'

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
