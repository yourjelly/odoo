# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import os

from odoo.tools import config, test_reports
from odoo.addons.hr_payroll.tests.common import TestPayslipBase
from datetime import datetime


class TestPayslipFlow(TestPayslipBase):

    def test_01_payslip_flow(self):
        """ Testing payslip flow and report printing """

        # Create Rules
        test_rule_alw = self.env['hr.salary.rule'].create({
            'name': 'Allowance',
            'code': 'TESTALW',
            'category_id': self.env.ref('hr_payroll.ALW').id,
            'amount_select': 'code',
            'amount_python_compute': "result = categories.ALW"
            })
        test_rule = self.env['hr.salary.rule'].create({
            'name': 'Test Rule',
            'amount_select': 'code',
            'code': 'SUMALWCATE',
            'category_id': self.env.ref('hr_payroll.ALW').id,
            'amount_python_compute': "result = payslip.sum_category('ALW', payslip.date_from, to_date=payslip.date_to)",
            })
        context = {
            "lang": "en_US", "tz": False, "active_model": "ir.ui.menu",
            "department_id": False, "section_id": False,
            "active_ids": [self.env.ref("hr_payroll.menu_department_tree")],
            "active_id": self.env.ref("hr_payroll.menu_department_tree")
        }

        # Create First payslip
        test_structure1 = self.env['hr.payroll.structure'].create({
            'name': 'Test structure',
            'code': 'TS1',
            'rule_ids': [(6, 0, [self.env.ref('hr_payroll.hr_rule_net').id, test_rule_alw.id])]
            })
        # I create an employee Payslip
        richard_payslip = self.env['hr.payslip'].create({
            'name': 'Payslip of Richard 01',
            'employee_id': self.richard_emp.id,
            'struct_id': test_structure1.id,
            'date_from': datetime.strptime('2019/01/01', '%Y/%m/%d'),
            'date_to': datetime.strptime('2019/02/28', '%Y/%m/%d'),
        })
        payslip_input1 = self.env['hr.payslip.input'].search([('payslip_id', '=', richard_payslip.id)])
        # I assign the amount to Input data
        payslip_input1.write({'amount': 5.0})
        # I verify the payslip is in draft state
        self.assertEqual(richard_payslip.state, 'draft', 'State not changed!')
        # I click on 'Compute Sheet' button on payslip
        richard_payslip.with_context(context).compute_sheet()
        # Then I click on the 'Confirm' button on payslip
        richard_payslip.action_payslip_done()
        # I verify that the payslip is in done state
        self.assertEqual(richard_payslip.state, 'done', 'State not changed!')

        # Create Second Payslip
        test_structure2 = self.env['hr.payroll.structure'].create({
            'name': 'Test structure2',
            'code': 'TS2',
            'rule_ids': [(6, 0, [self.env.ref('hr_payroll.hr_rule_basic').id, test_rule_alw.id])]
            })
        richard_payslip2 = self.env['hr.payslip'].create({
            'name': 'Payslip of Richard 02',
            'employee_id': self.richard_emp.id,
            'struct_id': test_structure2.id,
            'date_from': datetime.strptime('2019/01/01', '%Y/%m/%d'),
            'date_to': datetime.strptime('2019/02/28', '%Y/%m/%d'),
        })
        payslip_input2 = self.env['hr.payslip.input'].search([('payslip_id', '=', richard_payslip2.id)])
        payslip_input2.write({'amount': 5.0})
        self.assertEqual(richard_payslip2.state, 'draft', 'State not changed!')
        richard_payslip2.with_context(context).compute_sheet()
        richard_payslip2.action_payslip_done()
        self.assertEqual(richard_payslip2.state, 'done', 'State not changed!')

        # Create Third(Final) payslip
        test_structure3 = self.env['hr.payroll.structure'].create({
            'name': 'Test structure3',
            'code': 'TS3',
            'rule_ids': [(6, 0, [self.env.ref('hr_payroll.hr_rule_basic').id, self.env.ref('hr_payroll.hr_rule_taxable').id, test_rule.id])]
            })
        richard_payslip3 = self.env['hr.payslip'].create({
            'name': 'Payslip of Richard 03',
            'employee_id': self.richard_emp.id,
            'struct_id': test_structure3.id,
            'date_from': datetime.strptime('2019/01/01', '%Y/%m/%d'),
            'date_to': datetime.strptime('2019/02/28', '%Y/%m/%d'),
        })
        payslip_input3 = self.env['hr.payslip.input'].search([('payslip_id', '=', richard_payslip3.id)])
        payslip_input3.write({'amount': 5.0})
        self.assertEqual(richard_payslip3.state, 'draft', 'State not changed!')
        richard_payslip3.with_context(context).compute_sheet()
        sum_from_richard_payslip = richard_payslip.line_ids.filtered(lambda x:x.code == 'TESTALW').total
        sum_from_richard_payslip2 = richard_payslip2.line_ids.filtered(lambda x:x.code == 'TESTALW').total
        sum_from_richard_payslip3 = richard_payslip3.line_ids.filtered(lambda x:x.code == 'SUMALWCATE').total
        self.assertEqual(sum_from_richard_payslip + sum_from_richard_payslip2, sum_from_richard_payslip3, 'Allowance not calculated!')
        richard_payslip3.action_payslip_done()
        self.assertEqual(richard_payslip3.state, 'done', 'State not changed!')

        # I want to check refund payslip so I click on refund button.
        richard_payslip3.refund_sheet()

        # I check on new payslip Credit Note is checked or not.
        payslip_refund = self.env['hr.payslip'].search([('name', 'like', 'Refund: '+ richard_payslip3.name), ('credit_note', '=', True)])
        self.assertTrue(bool(payslip_refund), "Payslip not refunded!")

        # I want to generate a payslip from Payslip run.
        payslip_run = self.env['hr.payslip.run'].create({
            'date_end': datetime.strptime('2019/02/28', '%Y/%m/%d'),
            'date_start': datetime.strptime('2019/01/01', '%Y/%m/%d'),
            'name': 'Payslip for Employee'
        })

        # I create record for generating the payslip for this Payslip run.

        payslip_employee = self.env['hr.payslip.employees'].create({
            'employee_ids': [(4, self.richard_emp.id)]
        })

        # I generate the payslip by clicking on Generat button wizard.
        payslip_employee.with_context(active_id=payslip_run.id).compute_sheet()

        # I open Contribution Register and from there I print the Payslip Lines report.
        self.env['payslip.lines.contribution.register'].create({
            'date_from': datetime.strptime('2019/01/01', '%Y/%m/%d'),
            'date_to': datetime.strptime('2019/02/28', '%Y/%m/%d'),
        })

        # I print the payslip report
        data, data_format = self.env.ref('hr_payroll.action_report_payslip').render(richard_payslip3.ids)
        if config.get('test_report_directory'):
            open(os.path.join(config['test_report_directory'], 'hr_payroll-payslip.'+ data_format), 'wb+').write(data)

        # I print the payslip details report
        data, data_format = self.env.ref('hr_payroll.payslip_details_report').render(richard_payslip3.ids)
        if config.get('test_report_directory'):
            open(os.path.join(config['test_report_directory'], 'hr_payroll-payslipdetails.'+ data_format), 'wb+').write(data)

        # I print the contribution register report
        context = {'model': 'hr.contribution.register', 'active_ids': [self.env.ref('hr_payroll.hr_houserent_register').id]}
        test_reports.try_report_action(self.env.cr, self.env.uid, 'hr_payroll.action_payslip_lines_contribution_register', context=context, our_module='hr_payroll')
