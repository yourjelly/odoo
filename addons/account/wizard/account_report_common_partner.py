# -*- coding: utf-8 -*-

from openerp import api, fields, models


class AccountingReport(models.TransientModel):
    _name = 'account.common.partner.report'
    _description = 'Account Common Partner Report'
    _inherit = "account.common.report"
    
    result_selection = fields.Selection([('customer','Receivable Accounts'),
                                              ('supplier','Payable Accounts'),
                                              ('customer_supplier','Receivable and Payable Accounts')],
                                              string="Partner's", required=True, default='customer')


    def pre_print_report(self, data):
        data['form'].update(self.read(['result_selection'])[0])
        return data


#vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4:

