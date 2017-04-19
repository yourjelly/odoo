# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api
from odoo.tests import common


class TestAccountVoucherCommon(common.SavepointCase):

    @classmethod
    def setUpClass(cls):
        super(TestAccountVoucherCommon, cls).setUpClass()

        # Models
        cls.ResUsers = cls.env['res.users']
        cls.Account = cls.env['account.account']
        cls.Journal = cls.env['account.journal']
        cls.Voucher = cls.env['account.voucher']

        # User-groups and References
        cls.group_partner_manager_id = cls.env.ref('base.group_partner_manager')
        cls.group_account_user_id = cls.env.ref('account.group_account_user')
        cls.group_account_manager_id = cls.env.ref('account.group_account_manager')
        cls.company_id = cls.env.ref('base.main_company')
        account_type_receivable_id = cls.env.ref('account.data_account_type_receivable').id
        account_type_revenue_id = cls.env.ref('account.data_account_type_revenue').id
        account_type_liquidity_id = cls.env.ref('account.data_account_type_liquidity').id

        #AccountVoucher User creation
        cls.res_users_account_voucher_user = cls.ResUsers.create({
            'company_id': cls.company_id.id,
            'name': 'Voucher Accountant',
            'login': 'vacc',
            'email': 'accountant@yourcompany.com',
            'groups_id': [(6, 0, [cls.group_partner_manager_id.id, cls.group_account_user_id.id])] 
            })

        #AccountVoucher Manager creation
        cls.res_users_account_voucher_manager = cls.ResUsers.create({
            'company_id': cls.company_id.id,
            'name': 'Financial Manager for voucher',
            'login': 'fmv',
            'email': 'finmanager@yourcompany.com',
            'groups_id': [(6, 0, [cls.group_partner_manager_id.id, cls.group_account_manager_id.id])]
        })

        #Account for Receiveable
        cls.account_receivable = cls.Account.create({
            'code': 'X1012',
            'name': 'Debtors - (test)',
            'reconcile':  True,
            'user_type_id': account_type_receivable_id
            })

        #Account for Sale
        cls.account_sale = cls.Account.create({
            'code': 'X1020',
            'name': 'Product Sales - (test)',
            'user_type_id': account_type_revenue_id
            })

        #Account for Cash
        cls.account_cash = cls.Account.create({
            'code': 'X1015',
            'name': 'Cash - (test)',
            'user_type_id': account_type_liquidity_id
            })

        #Journal for Sales
        cls.sales_journal = cls.Journal.create({
            'name': 'Sales Journal - (test)',
            'code': 'TSAJ',
            'type': 'sale',
            'refund_sequence': True,
            'default_debit_account_id': cls.account_sale.id,
            'default_credit_account_id': cls.account_sale.id
            })

        #Journal for Cash
        cls.cash_journal = cls.Journal.create({
            'code': 'VCSH',
            'name': 'Cash Journal - (test)',
            'type': 'cash',
            'default_debit_account_id': cls.account_cash.id,
            'default_credit_account_id': cls.account_cash.id
            })
