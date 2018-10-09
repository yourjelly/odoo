from odoo import http
from odoo.http import request
import datetime
from datetime import date


class Balance(http.Controller):

    @http.route(['/list'], type='json', auth="public")
    def journal_list(self):
        plist = request.env['res.partner'].search_read([], ['id', 'name'])
        jlist = request.env['account.journal'].search_read([], ['id', 'name'])
        return {"partner_list": plist, "journal_list": jlist}

    @http.route(['/graph_search'], type='json', auth="public")
    def graph_search(self, input, partner_search=True):
        final_dict = {}
        currentWeek = date.today().isocalendar()[1]
        if partner_search:
            for j in request.env['account.journal'].search([]):
                datas = request.env['account.move'].search([('partner_id', '=', input), ('journal_id','=', j.id)])
                weeks = {'1': 0, '2': 0, '3': 0, '4': 0, '5': 0}
                for d in datas:
                    weekNumber = datetime.datetime.strptime(str(d.date), '%Y-%m-%d').isocalendar()[1]
                    if 0 <= currentWeek - weekNumber < 5:
                        weeks[str(currentWeek - weekNumber+1)] += d.amount
                final_dict.update({j.name: weeks})
        else:
            for p in request.env['res.partner'].search([]):
                datas = request.env['account.move'].search([('journal_id', '=', input), ('partner_id','=', p.id)])
                weeks = {'1': 0, '2': 0, '3': 0, '4': 0, '5': 0}
                for d in datas:
                    weekNumber = datetime.datetime.strptime(str(d.date), '%Y-%m-%d').isocalendar()[1]
                    if 0 <= currentWeek - weekNumber < 5:
                        weeks[str(currentWeek - weekNumber+1)] += d.amount
                final_dict.update({p.name: weeks})
        print(final_dict)
        return final_dict
