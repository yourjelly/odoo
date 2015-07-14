# -*- coding: utf-8 -*-

import time
from openerp import models, api, _


class report_overdue(models.AbstractModel):
    _name = 'report.account.report_overdue'

    @api.multi
    def _lines_get(self, partner):
        movelines = self.env['account.move.line'].search([('partner_id', '=', partner.id),
                    ('user_type_id.type', 'in', ['receivable', 'payable'])])
        return movelines

    @api.multi
    def render_html(self, data):
        report_obj = self.env['report']
        docs = self.env['res.partner'].browse(self.ids)
        due = {}
        paid = {}
        mat = {}

        for partner in docs:
            due[partner.id] = reduce(lambda x, y: x + ((y['user_type_id']['type'] == 'receivable' and y['debit'] or 0) or (y['user_type_id']['type'] == 'payable' and y['credit'] * -1 or 0)), self._lines_get(partner), 0)
            paid[partner.id] = reduce(lambda x, y: x + ((y['user_type_id']['type'] == 'receivable' and y['credit'] or 0) or (y['user_type_id']['type'] == 'payable' and y['debit'] * -1 or 0)), self._lines_get(partner), 0)
            mat[partner.id] = reduce(lambda x, y: x + (y['debit'] - y['credit']), filter(lambda x: x['date_maturity'] < time.strftime('%Y-%m-%d'), self._lines_get(partner)), 0)

        docargs = {
            'doc_ids': self.ids,
            'doc_model': 'res.partner',
            'docs': docs,
            'time': time,
            'addresses':docs._address_display(None, None),
            'getLines': self._lines_get(docs),
            'due': due,
            'paid': paid,
            'mat': mat,
        }
        return report_obj.render('account.report_overdue', docargs)
