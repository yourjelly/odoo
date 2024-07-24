from odoo.tests import HttpCase, tagged
from .common import MarketingCardCommon

@tagged('post_install', '-at_install')
class MarketingCardTour(HttpCase, MarketingCardCommon):

    def test_create_and_send_flows(self):
        self.marketing_card_manager.company_ids = self.env['res.company'].sudo().search([])
        self.marketing_card_manager.company_id = self.env.company
        self.marketing_card_manager.groups_id += self.env.ref('mass_mailing.group_mass_mailing_user')
        self.env['res.partner'].create({'name': 'bob', 'email': 'bob@test.lan'})

        self.start_tour('/web', 'marketing_card_tour', login="marketing_card_manager")
        self.env.ref('mass_mailing.ir_cron_mass_mailing_queue').sudo().method_direct_trigger()
        self.cr.precommit.run()

        mailing = self.env['mailing.mailing'].search([('name', 'like', 'Test Tour Marketing')], order="id DESC", limit=1)
        campaign_mail = self.env['card.campaign'].search([('name', '=', 'Test Tour Marketing Card')])
        campaign_mailing = self.env['card.campaign'].search([('name', '=', 'Test Tour Marketing Card Mailing')])

        Partner = self.env['res.partner'].with_user(self.marketing_card_manager).with_context(allowed_company_ids=self.env.company.ids)
        partner_count = Partner.search_count([])
        partner_wemail_count = Partner.search_count([('email', '!=', False)])

        self.assertIn(f'/cards/{campaign_mailing.id}/preview', mailing.body_arch)
        self.assertEqual(campaign_mail.card_count, partner_count)
        self.assertEqual(campaign_mailing.card_count, partner_wemail_count)
