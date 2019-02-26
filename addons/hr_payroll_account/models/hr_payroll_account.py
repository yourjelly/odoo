#-*- coding:utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.exceptions import UserError
from odoo.tools import float_compare, float_is_zero

# It's useless now.
# class HrPayslipLine(models.Model):
#     _inherit = 'hr.payslip.line'

#     def _get_partner_id(self, credit_account):
#         """
#         Get partner_id of slip line to use in account_move_line
#         """
#         # use partner of salary rule or fallback on employee's address
#         register_partner_id = self.salary_rule_id.register_id.partner_id
#         partner_id = register_partner_id.id or self.slip_id.employee_id.address_home_id.id
#         if credit_account:
#             if register_partner_id or self.salary_rule_id.account_credit.internal_type in ('receivable', 'payable'):
#                 return partner_id
#         else:
#             if register_partner_id or self.salary_rule_id.account_debit.internal_type in ('receivable', 'payable'):
#                 return partner_id
#         return False

class HrPayslip(models.Model):
    _inherit = 'hr.payslip'

    date = fields.Date('Date Account', states={'draft': [('readonly', False)], 'verify': [('readonly', False)]}, readonly=True,
        help="Keep empty to use the period of the validation(Payslip) date.")
    journal_id = fields.Many2one('account.journal', 'Salary Journal', readonly=True, related="struct_id.journal_id", store=True)
    move_id = fields.Many2one('account.move', 'Accounting Entry', readonly=True, copy=False)
    has_payslip_run = fields.Boolean(compute='_check_payslip_run_present', store=True)

    # It's useless now.
    # @api.model
    # def create(self, batch_attributes):
    #     if 'journal_id' in self.env.context:
    #         batch_attributes['journal_id'] = self.env.context.get('journal_id')
    #     return super(HrPayslip, self).create(batch_attributes)

    @api.depends('payslip_run_id')
    def _check_payslip_run_present(self):
        for record in self:
            if record.payslip_run_id:
                record.has_payslip_run = True
            else:
                record.has_payslip_run = False

    @api.onchange('employee_id', 'struct_id', 'date_from', 'date_to')
    def onchange_employee(self):
        super(HrPayslip, self).onchange_employee()
        self.journal_id = self.struct_id.journal_id.id

    @api.multi
    def action_payslip_cancel(self):
        moves = self.mapped('move_id')
        moves.filtered(lambda x: x.state == 'posted').button_cancel()
        moves.unlink()
        return super(HrPayslip, self).action_payslip_cancel()

    @api.multi
    def action_payslip_done(self):
        res = super(HrPayslip, self).action_payslip_done()
        precision = self.env['decimal.precision'].precision_get('Payroll')
        name = ''
        payslips = self
        slip_dict = {}

        for slip in payslips:
            run = slip.payslip_run_id
            if run:
                if run.check_payslips_are_ready():
                    payslips += run.slip_ids - payslips
                else:
                    payslips -= run.slip_ids

        for slip in payslips:
            if slip.state == 'done':
                key_journal_id = slip.struct_id.journal_id.id
                key_date = fields.Date().end_of(slip.date_to, 'month') # "the most important is the month. You can always set the last day of the month." -> @apr
                if key_journal_id in slip_dict.keys():      
                    if key_date in slip_dict[key_journal_id].keys():
                        slip_dict[key_journal_id][key_date].append(slip)
                    else:
                        slip_dict[key_journal_id].update({key_date : [slip]})
                else:
                    slip_dict.update({key_journal_id : {key_date : [slip]}})

        for key_journal_id in slip_dict:
            for key_date in slip_dict[key_journal_id]:
                line_ids = []
                debit_sum = 0.0
                credit_sum = 0.0
                date = key_date
                ref = date.strftime('%B %Y')
                move_dict = {
                    'narration': name,
                    'ref': ref,
                    'journal_id': key_journal_id,
                    'date': date,
                }

                for slip in slip_dict[key_journal_id][key_date]:
                    move_dict['narration'] += slip.number + ' - ' + slip.employee_id.name + '\n'

                    for line in slip.line_ids.filtered(lambda line: line.category_id):
                        amount = slip.credit_note and -line.total or line.total
                        if float_is_zero(amount, precision_digits=precision):
                            continue
                        debit_account_id = line.salary_rule_id.account_debit.id
                        credit_account_id = line.salary_rule_id.account_credit.id

                        if debit_account_id:
                            filtered_line = list(filter(lambda line_id: line_id[2]['name'] == line.name and line_id[2]['account_id'] == debit_account_id, line_ids))
                            debit_line = filtered_line.pop() if len(filtered_line) > 0 else ()

                            if not debit_line:
                                debit_line = (0, 0, {
                                    'name': line.name,
                                    'partner_id': False, 
                                    'account_id': debit_account_id,
                                    'journal_id': slip.struct_id.journal_id.id,
                                    'date': date,
                                    'debit': amount > 0.0 and amount or 0.0,
                                    'credit': amount < 0.0 and -amount or 0.0,
                                    'analytic_account_id': line.salary_rule_id.analytic_account_id.id or slip.contract_id.analytic_account_id.id,
                                    'tax_line_id': line.salary_rule_id.account_tax_id.id,
                                })
                                line_ids.append(debit_line)
                            else:
                                debit_line[2]['debit'] += amount > 0.0 and amount or 0.0
                                debit_line[2]['credit'] += amount < 0.0 and -amount or 0.0
                        
                        if credit_account_id:
                            filtered_line = list(filter(lambda line_id: line_id[2]['name'] == line.name and line_id[2]['account_id'] == credit_account_id, line_ids))
                            credit_line = filtered_line.pop() if len(filtered_line) > 0 else ()

                            if not credit_line:
                                credit_line = (0, 0, {
                                    'name': line.name,
                                    'partner_id': False,
                                    'account_id': credit_account_id,
                                    'journal_id': slip.struct_id.journal_id.id,
                                    'date': date,
                                    'debit': amount < 0.0 and -amount or 0.0,
                                    'credit': amount > 0.0 and amount or 0.0,
                                    'analytic_account_id': line.salary_rule_id.analytic_account_id.id or slip.contract_id.analytic_account_id.id,
                                    'tax_line_id': line.salary_rule_id.account_tax_id.id,
                                })
                                line_ids.append(credit_line)
                            else:
                                credit_line[2]['debit'] += amount < 0.0 and -amount or 0.0
                                credit_line[2]['credit'] += amount > 0.0 and amount or 0.0

                for line_id in line_ids:
                    debit_sum += line_id[2]['debit']
                    credit_sum += line_id[2]['credit']

                if float_compare(credit_sum, debit_sum, precision_digits=precision) == -1:
                    acc_id = slip.journal_id.default_credit_account_id.id
                    if not acc_id:
                        raise UserError(_('The Expense Journal "%s" has not properly configured the Credit Account!') % (slip.journal_id.name))
                    filtered_line = list(filter(lambda line_id: line_id[2]['name'] == _('Adjustment Entry'), line_ids))
                    adjust_credit = filtered_line.pop() if len(filtered_line) > 0 else ()
                    
                    if not adjust_credit:
                        adjust_credit = (0, 0, {
                            'name': _('Adjustment Entry'),
                            'partner_id': False,
                            'account_id': acc_id,
                            'journal_id': slip.journal_id.id,
                            'date': date,
                            'debit': 0.0,
                            'credit': debit_sum - credit_sum,
                        })
                        line_ids.append(adjust_credit)
                    else:
                        adjust_credit[2]['credit'] = debit_sum - credit_sum

                elif float_compare(debit_sum, credit_sum, precision_digits=precision) == -1:
                    acc_id = slip.journal_id.default_debit_account_id.id
                    if not acc_id:
                        raise UserError(_('The Expense Journal "%s" has not properly configured the Debit Account!') % (slip.journal_id.name))
                    filtered_line = list(filter(lambda line_id: line_id[2]['name'] == _('Adjustment Entry'), line_ids))
                    adjust_debit = filtered_line.pop() if len(filtered_line) > 0 else ()
                    
                    if not adjust_debit:
                        adjust_debit = (0, 0, {
                            'name': _('Adjustment Entry'),
                            'partner_id': False,
                            'account_id': acc_id,
                            'journal_id': slip.journal_id.id,
                            'date': date,
                            'debit': credit_sum - debit_sum,
                            'credit': 0.0,
                        })
                        line_ids.append(adjust_debit)
                    else:
                        adjust_debit[2]['debit'] = credit_sum - debit_sum

                move_dict['line_ids'] = line_ids
                move = self.env['account.move'].create(move_dict)
                for slip in slip_dict[key_journal_id][key_date]:
                    slip.write({'move_id': move.id, 'date': date})
                
                # move.post() --> @apr doesn't want a posted move when the payslips are validated.
        return res

class HrSalaryRule(models.Model):
    _inherit = 'hr.salary.rule'

    analytic_account_id = fields.Many2one('account.analytic.account', 'Analytic Account', company_dependent=True)
    account_tax_id = fields.Many2one('account.tax', 'Tax', company_dependent=True)
    account_debit = fields.Many2one('account.account', 'Debit Account', company_dependent=True, domain=[('deprecated', '=', False)])
    account_credit = fields.Many2one('account.account', 'Credit Account', company_dependent=True, domain=[('deprecated', '=', False)])

class HrContract(models.Model):
    _inherit = 'hr.contract'
    _description = 'Employee Contract'

    analytic_account_id = fields.Many2one('account.analytic.account', 'Analytic Account')
    journal_id = fields.Many2one('account.journal', 'Salary Journal', related="struct_id.journal_id", store=True)

class HrPayrollStructure(models.Model):
    _inherit = 'hr.payroll.structure'

    journal_id = fields.Many2one('account.journal', 'Salary Journal', readonly=False, required=False,
        default=lambda self: self.env['account.journal'].search([('type', '=', 'general')], limit=1))
    
