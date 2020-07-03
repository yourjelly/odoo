# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.account.tests.common import AccountTestInvoicingCommon


class TestExpenseCommon(AccountTestInvoicingCommon):

    @classmethod
    def setUpClass(cls, chart_template_ref=None):
        super().setUpClass(chart_template_ref=chart_template_ref)

        group_employee = cls.env.ref('base.group_user')
        user_group_manager = cls.env.ref('hr_expense.group_hr_expense_manager')
        Users = cls.env['res.users'].with_context({'no_reset_password': True, 'mail_create_nosubscribe': True, 'mail_create_nolog': True})
        cls.user_employee = Users.create({
            'name': 'Tyrion Lannister Employee',
            'login': 'tyrion',
            'email': 'tyrion@example.com',
            'notification_type': 'email',
            'groups_id': [(6, 0, [group_employee.id])],
            'property_account_payable_id': cls.company_data['default_account_payable'].id,
            'property_account_receivable_id': cls.company_data['default_account_receivable'].id,
            'company_id': cls.company_data['company'].id,
            'company_ids': cls.company_data['company'].ids,
        })
        cls.user_manager = Users.create({
            'name': 'Daenerys Targaryen Manager',
            'login': 'daenerys',
            'email': 'daenerys@example.com',
            'notification_type': 'email',
            'groups_id': [(6, 0, [user_group_manager.id, group_employee.id])],
            'property_account_payable_id': cls.company_data['default_account_payable'].id,
            'property_account_receivable_id': cls.company_data['default_account_receivable'].id,
            'company_id': cls.company_data['company'].id,
            'company_ids': cls.company_data['company'].ids,
        })

        # create employee
        cls.employee = cls.env['hr.employee'].create({
            'name': 'Johnny Employee',
            'user_id': cls.user_employee.id,
            'address_home_id': cls.user_employee.partner_id.id,
            'address_id': cls.user_employee.partner_id.id,
        })

        # Create tax
        cls.tax = cls.env['account.tax'].create({
            'name': 'Expense 10%',
            'amount': 10,
            'amount_type': 'percent',
            'type_tax_use': 'purchase',
            'price_include': True,
        })

        # Create analytic account
        cls.analytic_account = cls.env['account.analytic.account'].create({
            'name': 'Test Analytic Account for Expenses',
        })

        # Expense reports
        cls.journal = cls.company_data['default_journal_purchase']
        cls.expense_sheet = cls.env['hr.expense.sheet'].create({
            'name': 'Expense for Johnny Employee',
            'employee_id': cls.employee.id,
            'journal_id': cls.journal.id,
        })
        cls.expense_sheet2 = cls.env['hr.expense.sheet'].create({
            'name': 'Second Expense for Johnny Employee',
            'employee_id': cls.employee.id,
            'journal_id': cls.journal.id,
        })

        Users = cls.env['res.users'].with_context(no_reset_password=True)

        # Find Employee group
        group_employee_id = cls.env.ref('base.group_user').id

        cls.user_emp2 = Users.create({
            'name': 'Superboy Employee',
            'login': 'superboy',
            'email': 'superboy@example.com',
            'groups_id': [(6, 0, [group_employee_id])]
        })

        cls.user_officer = Users.create({
            'name': 'Batman Officer',
            'login': 'batman',
            'email': 'batman.hero@example.com',
            'groups_id': [(6, 0, [group_employee_id, cls.env.ref('hr_expense.group_hr_expense_team_approver').id])]
        })

        cls.emp_emp2 = cls.env['hr.employee'].create({
            'name': 'Superboy',
            'user_id': cls.user_emp2.id,
        })

        cls.emp_officer = cls.env['hr.employee'].create({
            'name': 'Batman',
            'user_id': cls.user_officer.id,
        })

        cls.emp_manager = cls.env['hr.employee'].create({
            'name': 'Superman',
            'user_id': cls.user_manager.id,
        })

        cls.rd = cls.env['hr.department'].create({
            'name': 'R&D',
            'manager_id': cls.emp_officer.id,
            'member_ids': [(6, 0, [cls.employee.id])],
        })

        cls.ps = cls.env['hr.department'].create({
            'name': 'PS',
            'manager_id': cls.emp_manager.id,
            'member_ids': [(6, 0, [cls.emp_emp2.id])],
        })

        cls.uom_unit = cls.env.ref('uom.product_uom_unit').id
        cls.uom_dozen = cls.env.ref('uom.product_uom_dozen').id

        cls.product_1 = cls.env['product.product'].create({
            'name': 'Batmobile repair',
            'type': 'service',
            'uom_id': cls.uom_unit,
            'uom_po_id': cls.uom_unit,
        })

        cls.product_2 = cls.env['product.product'].create({
            'name': 'Superboy costume washing',
            'type': 'service',
            'uom_id': cls.uom_unit,
            'uom_po_id': cls.uom_unit,
        })


class TestExpenseMultiCompanyCommon(TestExpenseCommon):

    @classmethod
    def setUpClass(cls, chart_template_ref=None):
        super().setUpClass(chart_template_ref=chart_template_ref)

        group_employee = cls.env.ref('base.group_user')
        user_group_manager = cls.env.ref('hr_expense.group_hr_expense_manager')
        Users = cls.env['res.users'].with_context({'no_reset_password': True, 'mail_create_nosubscribe': True, 'mail_create_nolog': True})
        cls.user_employee_company_B = Users.create({
            'name': 'Tyrion Lannister Employee',
            'login': 'tyrion',
            'email': 'tyrion@example.com',
            'notification_type': 'email',
            'groups_id': [(6, 0, [group_employee.id])],
            'property_account_payable_id': cls.company_data_2['default_account_payable'].id,
            'property_account_receivable_id': cls.company_data_2['default_account_receivable'].id,
            'company_id': cls.company_data_2['company'].id,
            'company_ids': cls.company_data_2['company'].ids,
        })
        cls.user_manager_company_B = Users.create({
            'name': 'Daenerys Targaryen Manager',
            'login': 'daenerys',
            'email': 'daenerys@example.com',
            'notification_type': 'email',
            'groups_id': [(6, 0, [user_group_manager.id, group_employee.id])],
            'property_account_payable_id': cls.company_data_2['default_account_payable'].id,
            'property_account_receivable_id': cls.company_data_2['default_account_receivable'].id,
            'company_id': cls.company_data_2['company'].id,
            'company_ids': cls.company_data_2['company'].ids,
        })

        # create employee
        cls.employee = cls.env['hr.employee'].create({
            'name': 'Tyrion Lannister',
            'user_id': cls.user_employee.id,
            'address_home_id': cls.user_employee.partner_id.id,
            'address_id': cls.user_employee.partner_id.id,
        })

        cls.employee_company_B = cls.env['hr.employee'].create({
            'name': 'Gregor Clegane',
            'user_id': cls.user_employee_company_B.id,
            'address_home_id': cls.user_employee_company_B.partner_id.id,
            'address_id': cls.user_employee_company_B.partner_id.id,
        })

        # Create tax
        cls.tax = cls.env['account.tax'].create({
            'name': 'Expense 10%',
            'amount': 10,
            'amount_type': 'percent',
            'type_tax_use': 'purchase',
            'price_include': True,
            'company_id': cls.company_data['company'].id,
        })
        cls.tax_company_B = cls.env['account.tax'].create({
            'name': 'Expense 10%',
            'amount': 10,
            'amount_type': 'percent',
            'type_tax_use': 'purchase',
            'price_include': True,
            'company_id': cls.company_data_2['company'].id,
        })

        # Create analytic account
        cls.analytic_account = cls.env['account.analytic.account'].create({
            'name': 'Test Analytic Account for Expenses',
            'company_id': cls.company_data['company'].id,
        })
        cls.analytic_account_company_B = cls.env['account.analytic.account'].create({
            'name': 'Test Analytic Account for Expenses',
            'company_id': cls.company_data_2['company'].id,
        })

        # Expense reports
        cls.journal = cls.env['account.journal'].create({
            'name': 'Purchase Journal - Test',
            'code': 'HRTPJ',
            'type': 'purchase',
            'company_id': cls.company_data['company'].id,
        })
        cls.journal_company_B = cls.env['account.journal'].create({
            'name': 'Purchase Journal Company B - Test',
            'code': 'HRTPJ',
            'type': 'purchase',
            'company_id': cls.company_data_2['company'].id,
        })

        cls.expense_sheet = cls.env['hr.expense.sheet'].create({
            'name': 'Expense for Tyrion',
            'employee_id': cls.employee.id,
            'journal_id': cls.journal.id,
        })
        cls.expense_sheet2 = cls.env['hr.expense.sheet'].create({
            'name': 'Second Expense for Tyrion',
            'employee_id': cls.employee.id,
            'journal_id': cls.journal.id,
        })

        cls.product_1 = cls.env['product.product'].create({
            'name': 'Sword sharpening',
            'type': 'service',
            'uom_id': cls.env.ref('uom.product_uom_unit').id,
            'uom_po_id': cls.env.ref('uom.product_uom_unit').id,
            'property_account_expense_id': cls.account_expense.id,
        })

        cls.product_2 = cls.env['product.product'].create({
            'name': 'Armor cleaning',
            'type': 'service',
            'uom_id': cls.env.ref('uom.product_uom_unit').id,
            'uom_po_id': cls.env.ref('uom.product_uom_unit').id,
            'property_account_expense_id': cls.account_expense.id,
        })
