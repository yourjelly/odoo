# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.sale_project.tests.test_project_profitability import TestProjectProfitabilityCommon
from odoo.addons.sale_subscription.tests.common_sale_subscription import TestSubscriptionCommon
from odoo.tests import tagged

@tagged('-at_install', 'post_install')
class TestProjectSubscriptionExpensePurchase(TestProjectProfitabilityCommon, TestSubscriptionCommon):

    def test_recurring_expensable_analytic_account_billing(self):
        """
        """
        self.product_delivery_service.recurring_invoice = True
        subscription = self.env['sale.order'].create({
            'name': 'TestSubscription',
            'is_subscription': True,
            'plan_id': self.plan_month.id,
            'note': "original subscription description",
            'partner_id': self.user_portal.partner_id.id,
            'sale_order_template_id': self.subscription_tmpl.id,
            'order_line': [(0, 0, {
                'product_id': self.product_delivery_service.id,
                'product_uom_qty': 1,
            })],
        })
        subscription.action_confirm()
        subscription.order_line.qty_delivered = 1
        subscription._create_invoices()
        subscription_invoice_1 = subscription.invoice_ids[0]
        subscription_invoice_1.action_post()
        res = subscription.prepare_renewal_order()
        subscription.action_confirm()
        expensable_service_product = self.material_product
        expensable_service_product.write({
            'type': 'service',
            'can_be_expensed': True,
            'expense_policy': 'sales_price',
        })

        rfq = self.env['purchase.order'].create({
            'partner_id': self.partner_a.id,
            'order_line': [(0, 0, {
                'product_id': expensable_service_product.id,
                'product_uom_qty': 1,
                'analytic_distribution': { self.analytic_account.id : 100.0 },
            })]
        })
        rfq.button_confirm()
        rfq.action_create_invoice()
        pass
