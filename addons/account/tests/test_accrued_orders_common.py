# -*- coding: utf-8 -*-
from odoo import Command
from odoo.addons.account.tests.common import AccountTestInvoicingCommon
from odoo.tests import tagged
from odoo.exceptions import UserError


@tagged('post_install', '-at_install')
class TestAccruedOrdersCommon(AccountTestInvoicingCommon):

    @classmethod
    def setUpClass(cls, chart_template_ref=None):
        super().setUpClass(chart_template_ref=chart_template_ref)
        uom_unit = cls.env.ref('uom.product_uom_unit')
        uom_hour = cls.env.ref('uom.product_uom_hour')
        cls.alt_inc_account = cls.company_data['default_account_revenue'].copy()
        cls.currency_a = cls.env['res.currency'].create({
            'name': 'CUR',
            'symbol': 'c',
            'rounding': 0.01,
        })
        cls.env['res.currency.rate'].create({
            'currency_id': cls.currency_a.id,
            'rate': 1.5,
        })
        cls.product_order = cls.env['product.product'].create({
            'name': "Product",
            'list_price': 30.0,
            'type': 'consu',
            'uom_id': uom_unit.id,
            'uom_po_id': uom_unit.id,
            'invoice_policy': 'delivery',
            'property_account_income_id': cls.alt_inc_account.id,
        })
        cls.service_order = cls.env['product.product'].create({
            'name': "Service",
            'list_price': 50.0,
            'type': 'service',
            'uom_id': uom_hour.id,
            'uom_po_id': uom_hour.id,
            'invoice_policy': 'delivery',
        })
        cls.sale_order = cls.env['sale.order'].with_context(tracking_disable=True).create({
            'partner_id': cls.partner_a.id,
            'order_line': [
                cls._get_order_line_command(cls.product_order),
                cls._get_order_line_command(cls.service_order),
            ]
        })
        cls.sale_order.action_confirm()
        cls.account_expense = cls.company_data['default_account_expense']
        cls.account_revenue = cls.company_data['default_account_revenue']
        cls.wizard = cls.env['account.accrued.orders.wizard'].with_context({
            'active_model': 'sale.order',
            'active_ids': cls.sale_order.ids,
        }).create({
            'account_id': cls.account_expense.id,
        })

    @classmethod
    def _get_order_line_command(cls, product):
        return Command.create({
            'name': product.name,
            'product_id': product.id,
            'product_uom_qty': 10.0,
            'product_uom': product.uom_id.id,
            'price_unit': product.list_price,
            'tax_id': False,
        })
