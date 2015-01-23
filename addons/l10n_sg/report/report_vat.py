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

    def _get_lines(self, based_on, company_id=False, parent=False, level=0, sequence=None, printable=False, context=None):

        if res.printable:
            res_dict.update({ 'sequence': res.sequence})
        return super(tax_report, self)._get_lines(based_on, company_id=company_id, parent=parent, level=level, sequence=sequence, printable=printable, context=context)

class report_vat(osv.AbstractModel):
    _name = 'report.account.report_vat'
    _inherit = 'report.abstract_report'
    _template = 'account.report_vat'
    _wrapped_report_class = tax_report

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4: