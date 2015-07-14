# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from openerp.addons.account.report.common_report_header import common_report_header
from openerp import api, fields, models, _

# ---------------------------------------------------------
# Account Financial Report
# ---------------------------------------------------------

class AccountFinancialReport(models.Model, common_report_header):
    _name = "account.financial.report"
    _description = "Account Report"

    @api.depends('parent_id')
    def _compute_level(self):
        '''Returns a dictionary with key=the ID of a record and value = the level of this  
            record in the tree structure.'''
        for report in self:
            level = 0
            if report.parent_id:
                level = report.parent_id.level + 1
            self.level = level

    def _get_children_by_order(self):
        '''returns a dictionary with the key= the ID of a record and value = all its children,
           computed recursively, and sorted by sequence. Ready for the printing'''
        res = []
        for account in self:
            res.append(account)
            ids2 = self.search([('parent_id', '=', account.id)], order='sequence ASC')
            res += ids2._get_children_by_order()
        return res

    @api.multi
    def _compute_balance(self):
        '''returns a dictionary with key=the ID of a record and value=the balance amount 
           computed for this record. If the record is of type :
               'accounts' : it's the sum of the linked accounts
               'account_type' : it's the sum of leaf accoutns with such an account_type
               'account_report' : it's the amount of the related report
               'sum' : it's the sum of the children of this record (aka a 'view' record)'''
        for report in self:
            if report.account_type == 'accounts':
                # it's the sum of the linked accounts
                data = self._compute(report.account_ids)
                for account in report.account_ids:
                    report.debit += data[account.id].get('debit') if account.id in data else 0.00
                    report.credit += data[account.id].get('credit') if account.id in data else 0.00
                    report.balance += data[account.id].get('balance') if account.id in data else 0.00
            elif report.account_type == 'account_type':
                # it's the sum the leaf accounts with such an account type
                report_types = [x.id for x in report.account_type_ids]
                accounts = self.env['account.account'].search([('user_type_id','in', report_types)])
                data = self._compute(accounts)
                for account in accounts:
                    report.debit += data[account.id].get('debit') if account.id in data else 0.00
                    report.credit += data[account.id].get('credit') if account.id in data else 0.00
                    report.balance += data[account.id].get('balance') if account.id in data else 0.00
            elif report.account_type == 'account_report' and report.account_report_id:
                # it's the amount of the linked report
                res2 = report.account_report_id
                report.balance += res2.balance
                report.debit += res2.debit
                report.credit += res2.credit
            elif report.account_type == 'sum':
                # it's the sum of the children of this account.report
                for rec in report.children_ids:
                    report.debit += rec.debit
                    report.credit += rec.credit
                    report.balance += rec.balance

    name = fields.Char(string='Report Name', required=True)
    parent_id = fields.Many2one('account.financial.report', string='Parent')
    children_ids = fields.One2many('account.financial.report', 'parent_id', string='Account Report')
    sequence = fields.Integer(string='Sequence')
    balance = fields.Float(compute='_compute_balance')
    debit = fields.Float(compute='_compute_balance')
    credit = fields.Float(compute='_compute_balance')
    level = fields.Integer(compute='_compute_level', store=True)
    account_type = fields.Selection([
        ('sum','View'),
        ('accounts','Accounts'),
        ('account_type','Account Type'),
        ('account_report','Report Value'),
        ], string='Type', default='sum', old_name='type')
    account_ids = fields.Many2many('account.account', 'account_account_financial_report', 'report_line_id', 'account_id', string='Accounts')
    account_report_id = fields.Many2one('account.financial.report', string='Report Value')
    account_type_ids = fields.Many2many('account.account.type', 'account_account_financial_report_type', 'report_id', 'account_type_id', string='Account Types')
    sign = fields.Selection([(-1, 'Reverse balance sign'), (1, 'Preserve balance sign')], string='Sign on Reports', required=True, default=1, help='For accounts that are typically more debited than credited and that you would like to print as negative amounts in your reports, you should reverse the sign of the balance; e.g.: Expense account. The same applies for accounts that are typically more credited than debited and that you would like to print as positive amounts in your reports; e.g.: Income account.')
    display_detail = fields.Selection([
        ('no_detail','No detail'),
        ('detail_flat','Display children flat'),
        ('detail_with_hierarchy','Display children with hierarchy')
        ], string='Display details', default='detail_flat')
    style_overwrite = fields.Selection([
        (0, 'Automatic formatting'),
        (1,'Main Title 1 (bold, underlined)'),
        (2,'Title 2 (bold)'),
        (3,'Title 3 (bold, smaller)'),
        (4,'Normal Text'),
        (5,'Italic Text (smaller)'),
        (6,'Smallest Text'),
        ], string='Financial Report Style', default=0, help="You can set up here the format you want this record to be displayed. If you leave the automatic formatting, it will be computed based on the financial reports hierarchy (auto-computed field 'level').")
