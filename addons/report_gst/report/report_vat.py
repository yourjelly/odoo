# -*- coding: utf-8 -*-

from openerp.addons.account.report import report_vat
from openerp.report import report_sxw
from functools import partial
from openerp.osv import osv

class tax_report(report_vat.tax_report):

    def __init__(self, cr, uid, name, context):
        super(tax_report, self).__init__(cr, uid, name, context)
        self.localcontext.update({
            'get_lines': partial(self._get_lines, context=context),
        })

    def set_context(self, objects, data, ids, report_type=None):
        new_ids = ids
        res = {}
        self.period_ids = []
        period_obj = self.pool.get('account.period')
        self.display_detail = data['form']['display_detail']
        res['periods'] = ''
        res['fiscalyear'] = data['form'].get('fiscalyear_id', False)

        if data['form'].get('period_from', False) and data['form'].get('period_to', False):
            self.period_ids = period_obj.build_ctx_periods(self.cr, self.uid, data['form']['period_from'], data['form']['period_to'])
            periods_l = period_obj.read(self.cr, self.uid, self.period_ids, ['name'])
            for period in periods_l:
                if res['periods'] == '':
                    res['periods'] = period['name']
                else:
                    res['periods'] += ", "+ period['name']
        return super(tax_report, self).set_context(objects, data, new_ids, report_type=report_type)
    
    def _get_lines(self, based_on, company_id=False, parent=False, level=0, context=None):
        period_list = self.period_ids
        res = self._get_codes(based_on, company_id, parent, level, period_list, context=context)
        if period_list:
            self.res = self._add_codes(based_on, res, period_list, context=context)
        else:
            self.cr.execute ("select id from account_fiscalyear")
            fy = self.cr.fetchall()
            self.cr.execute ("select id from account_period where fiscalyear_id = %s",(fy[0][0],))
            periods = self.cr.fetchall()
            for p in periods:
                period_list.append(p[0])
            self.res = self._add_codes(based_on, res, period_list, context=context)
        i = 0
        top_result = []
        while i < len(res):
            if res[i][1].printable:
                res_dict = { 'code': res[i][1].code,
                    'name': res[i][1].name,
                    'debit': 0,
                    'credit': 0,
                    'tax_amount': res[i][1].sum_period,
                    'type': 1,
                    'level': res[i][0],
                    'pos': 0,
                    'sequence': res[i][1].sequence
                }

                top_result.append(res_dict)
#                res_general = self._get_general(res[i][1].id, period_list, company_id, based_on, context=context)
#                ind_general = 0
#                while ind_general < len(res_general):
#                    res_general[ind_general]['type'] = 2
#                    res_general[ind_general]['pos'] = 0
#                    res_general[ind_general]['level'] = res_dict['level']
#                    res_general[ind_general]['sequence'] = res_dict['sequence']
#                    top_result.append(res_general[ind_general])
#                    ind_general+=1
            i+=1
        top_result = sorted(top_result, key=lambda k: k['sequence'])
        return top_result


class report_vat(osv.AbstractModel):
    _name = 'report.account.report_vat'
    _inherit = 'report.abstract_report'
    _template = 'account.report_vat'
    _wrapped_report_class = tax_report

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4:
