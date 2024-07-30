from odoo.tests.common import HttpCase, tagged


@tagged('post_install', '-at_install')
class TestLoyaltyPortal(HttpCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.portal_user = cls.env['res.users'].create({
            'name': 'Test User',
            'login': 'testuser',
            'email': 'testuser@example.com',
        })
        cls.loyalty_program = cls.env['loyalty.program'].create({
            'name': 'Test Loyalty Program',
            'program_type': 'loyalty',
        })
        cls.program_wallet = cls.env['loyalty.program'].create({
            'name': 'Test Loyalty Program',
            'program_type': 'ewallet',
        })

    def test_portal_loyalty_card(self):
        self.loyalty_card = self.env['loyalty.card'].create({
            'partner_id': self.portal_user.partner_id.id,
            'program_id': self.loyalty_program.id,
            'points': 100,
        })
        self.ewallet = self.env['loyalty.card'].create({
            'partner_id': self.portal_user.partner_id.id,
            'program_id': self.program_wallet.id,
            'points': 100,
        })
        self.start_tour("/", "loyalty_portal_tour", login="testuser")
