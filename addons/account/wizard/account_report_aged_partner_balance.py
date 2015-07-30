# -*- coding: utf-8 -*-

import time
from datetime import datetime
from dateutil.relativedelta import relativedelta
from openerp import api, fields, models, _
from openerp.exceptions import Warning


class account_aged_trial_balance(models.TransientModel):
    _name = 'account.aged.trial.balance'
    _inherit = 'account.common.partner.report'
    _description = 'Account Aged Trial balance Report'

    period_length = fields.Integer(string='Period Length (days)', required=True, default=30)
    direction_selection = fields.Selection([('past','Past'), ('future','Future')], string='Analysis Direction', default='past', required=True)
    journal_ids = fields.Many2many('account.journal', string='Journals', required=True)


#    _defaults = {
#        'period_length': 30,
#        'date_from': lambda *a: time.strftime('%Y-%m-%d'),
#        'direction_selection': 'past',
#    }

    def _print_report(self, data):
        res = {}
        data = self.pre_print_report(data)
        data['form'].update(self.read(['period_length', 'direction_selection'])[0])
        period_length = data['form']['period_length']
        if period_length<=0:
            raise Warning(_('You must set a period length greater than 0.'))
        if not data['form']['date_from']:
            raise Warning(_('You must set a start date.'))

        start = datetime.strptime(data['form']['date_from'], "%Y-%m-%d")

        if data['form']['direction_selection'] == 'past':
            for i in range(5)[::-1]:
                stop = start - relativedelta(days=period_length)
                res[str(i)] = {
                    'name': (i!=0 and (str((5-(i+1)) * period_length) + '-' + str((5-i) * period_length)) or ('+'+str(4 * period_length))),
                    'stop': start.strftime('%Y-%m-%d'),
                    'start': (i!=0 and stop.strftime('%Y-%m-%d') or False),
                }
                start = stop - relativedelta(days=1)
        else:
            for i in range(5):
                stop = start + relativedelta(days=period_length)
                res[str(5-(i+1))] = {
                    'name': (i!=4 and str((i) * period_length)+'-' + str((i+1) * period_length) or ('+'+str(4 * period_length))),
                    'start': start.strftime('%Y-%m-%d'),
                    'stop': (i!=4 and stop.strftime('%Y-%m-%d') or False),
                }
                start = stop + relativedelta(days=1)
        data['form'].update(res)
        print"\n\n\ndata....",data
        return self.env['report'].get_action(self, 'account.report_agedpartnerbalance', data=data)

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4:

