from odoo.tests.common import tagged, HttpCase
from odoo.fields import Command


@tagged('post_install', '-at_install')
class TestSaleLoyaltyPortal(HttpCase):

    def test_loyalty_wallet_topup(self):
        self.partner_a = self.env['res.partner'].create({'name': 'John Doe'})
        self.product = self.env['product.product'].create({
            'name': 'test ewallet topup',
            'standard_price': 50,
        })
        self.ewallet_program = self.env['loyalty.program'].create({
            'name': 'eWallet Program',
            'program_type': 'ewallet',
            'applies_on': 'future',
            'trigger': 'auto',
            'trigger_product_ids': self.product,
            'rule_ids': [Command.create({
                'reward_point_mode': 'money',
            })],
            'reward_ids': [Command.create({
                'discount_mode': 'per_point',
                'discount': 1,
                'discount_applicability': 'order',
            })],
        })
        self.ewallet_card = self.env['loyalty.card'].create({
            'program_id': self.ewallet_program.id,
            'partner_id': self.partner_a.id,
        })
        # response = self.url_open(f'/topup?product={self.product.id}')
        # self.assertEqual(response.status_code, 200, "Expected status code 200")
        # self.assertIn('/payment/pay?', response.url, "Expected redirect to payment page")
