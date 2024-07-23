from datetime import datetime, timedelta
from lxml import html
from markupsafe import Markup

from odoo import exceptions
from odoo.tools import mute_logger
from odoo.tests.common import users, warmup
from odoo.tests import Form, tagged, TransactionCase, HttpCase
from odoo.addons.mail.tests.common import MailCase
from odoo.addons.marketing_card.controllers.marketing_card import SOCIAL_NETWORK_USER_AGENTS

from .common import MarketingCardCommon, neuter_image_render, ROLES


class TestMarketingCardRender(MarketingCardCommon):

    @neuter_image_render
    @users('marketing_card_user')
    def test_campaign(self):
        self.campaign = self.campaign.with_user(self.env.user)
        self.assertEqual(set(self.campaign.card_element_ids.mapped('card_element_role')), set(ROLES))

        self.assertFalse(self.campaign.preview_record_url)

        element_by_role = self.campaign.card_element_ids.grouped('card_element_role')

        with self.mock_image_renderer():
            element_by_role['header'].write({
                'card_element_text': 'Come and See',
                'text_color': '#CC8888',
            })
            self.assertTrue(self.campaign.image_preview)

        role_values = self._extract_values_from_document(html.fromstring(self._wkhtmltoimage_bodies[0]))
        self.assertNotIn('style', role_values['body'].attrib)
        self.assertEqual(role_values['header'].text, 'Come and See')
        self.assertEqual(role_values['header'].attrib['style'], 'color: #CC8888;')
        self.assertEqual(role_values['subheader'].text, '[name]')
        self.assertEqual(role_values['section_1'].text, '[event_id]')
        self.assertEqual(role_values['subsection_1'].text, '[event_id.location_id]')
        self.assertEqual(role_values['subsection_2'].text, '[event_id.location_id.tag_ids]')
        self.assertFalse(role_values['button'].text)
        print(role_values['image_1'].attrib)
        self.assertTrue(role_values['image_1'].attrib['src'], 'Placeholder image should be displayed')
        self.assertNotIn('src', role_values['image_2'].attrib)

        # first record

        with self.mock_image_renderer():
            self.campaign.preview_record_ref = self.concert_performances[0]
            self.assertTrue(self.campaign.image_preview)
        role_values = self._extract_values_from_document(html.fromstring(self._wkhtmltoimage_bodies[0]))
        self.assertNotIn('style', role_values['body'].attrib)
        self.assertEqual(role_values['header'].text, 'Come and See')
        self.assertEqual(role_values['header'].attrib['style'], 'color: #CC8888;')
        self.assertEqual(role_values['subheader'].text, "John's Holiday")
        self.assertEqual(role_values['section_1'].text, 'Concert')
        self.assertEqual(role_values['subsection_1'].text, 'Green Plaza')
        self.assertEqual(role_values['subsection_2'].text, 'Free Access Open Space')
        self.assertFalse(role_values['button'].text)
        # don't use placeholder when rendering for a record
        self.assertFalse(self.campaign.preview_record_ref.mapped(element_by_role['image_1'].field_path)[0])
        self.assertNotIn('src', role_values['image_1'].attrib, 'Placeholder image should not be displayed')
        self.assertNotIn('src', role_values['image_2'].attrib)

        campaign_url_john = self.campaign.preview_record_url
        self.assertTrue(campaign_url_john)

        # second record, modified tags

        with self.mock_image_renderer():
            self.concert_performances[1].event_id.location_id.tag_ids = self.tag_open
            self.campaign.preview_record_ref = self.concert_performances[1]
            self.assertTrue(self.campaign.image_preview)
        role_values = self._extract_values_from_document(html.fromstring(self._wkhtmltoimage_bodies[0]))
        self.assertNotIn('style', role_values['body'].attrib)
        self.assertEqual(role_values['header'].text, 'Come and See')
        self.assertEqual(role_values['header'].attrib['style'], 'color: #CC8888;')
        self.assertEqual(role_values['subheader'].text, "Bob's (grand) slam")
        self.assertEqual(role_values['section_1'].text, 'Concert')
        self.assertEqual(role_values['subsection_1'].text, 'Green Plaza')
        self.assertEqual(role_values['subsection_2'].text, 'Open Space')
        self.assertFalse(role_values['button'].text)
        self.assertFalse(self.campaign.preview_record_ref.mapped(element_by_role['image_1'].field_path)[0])
        self.assertNotIn('src', role_values['image_1'], 'Placeholder image should not be displayed')
        self.assertNotIn('src', role_values['image_2'])

        self.assertNotEqual(campaign_url_john, self.campaign.preview_record_url)

        # update previewed record fields

        with self.mock_image_renderer():
            self.campaign.preview_record_ref.name = 'An updated name'
            self.assertTrue(self.campaign.image_preview)
        self.assertFalse(self._wkhtmltoimage_bodies, 'Updating the preview record does not refresh the preview.')

        # url remains consistent

        self.campaign.preview_record_ref = self.concert_performances[0]
        self.assertEqual(campaign_url_john, self.campaign.preview_record_url)

    @neuter_image_render
    @users('marketing_card_manager')
    def test_campaign_field_paths(self):
        """Check that only allowed fields and models are selectable for regular users.

        Field paths should only be valid for the selected model, allow rules do not transitively apply.
        e.g. I may render `partner.address`, and `user.partner`, but I may not necessarily render `user.partner.address`
        Only specified models should be selectable for rendering.
        Switching model should always reset the fields.
        """
        self.campaign = self.campaign.with_user(self.env.user)
        subheader_element = self.campaign.card_element_ids.filtered(lambda el: el.card_element_role == 'subheader')
        with self.assertRaises(exceptions.ValidationError):
            subheader_element.field_path = 'secret'
        with self.assertRaises(exceptions.ValidationError):
            subheader_element.field_path = 'event_id.location_id.secret'

        # switching to location as render model, now `secret` is allowed but not `name`
        self.campaign.res_model = 'card.test.event.location'
        self.assertEqual(set(self.campaign.card_element_ids.mapped('value_type')), {'static'})
        self.assertEqual(set(self.campaign.card_element_ids.mapped('field_path')), {False})
        subheader_element.write({'value_type': 'field', 'field_path': 'secret'})
        with self.assertRaises(exceptions.ValidationError):
            subheader_element.write({'value_type': 'field', 'field_path': 'name'})

        # switching model using the preview record should reset field paths too
        self.campaign.preview_record_ref = self.concert_performances[0]
        self.assertEqual(set(self.campaign.card_element_ids.mapped('value_type')), {'static'})
        self.assertEqual(set(self.campaign.card_element_ids.mapped('field_path')), {False})
        self.assertEqual(self.campaign.res_model, 'card.test.event.performance')

        # events are not valid targets
        with self.assertRaises(ValueError):
            self.campaign.res_model = 'card.test.event'


class TestMarketingCardMail(MailCase, MarketingCardCommon):

    @users('marketing_card_user')
    @mute_logger('odoo.addons.mail.models.mail_mail')
    def test_campaign_send_mail(self):
        self.campaign = self.campaign.with_user(self.env.user)
        self.assertFalse(self.env['card.card'].search([('campaign_id', '=', self.campaign.id)]))

        with self.mock_image_renderer(), self.mock_mail_gateway():
            self.env['card.card.share'].create({
                'card_campaign_id': self.campaign.id,
                'message': "<p>Here's your link</p>",
            }).action_send()
        self.assertEqual(len(self._new_mails), 2)

        for record in self.concert_performances:
            preview_url = f"{self.campaign.get_base_url()}/cards/{self.campaign.id}/{record.id}/{self.campaign._generate_card_hash_token(record.id)}/preview"
            self.assertEqual(preview_url, self.campaign._get_preview_url_from_res_id(record.id))
            self.assertMailMailWRecord(
                record,
                record.partner_id,
                "outgoing",
                content=f"""<div><p>Here\'s your link</p></div>\n<a class="o_no_link_popover" href="{preview_url}">Your Card</a>"""
            )

        self.assertFalse(self._wkhtmltoimage_bodies)
        cards = self.env['card.card'].search([('campaign_id', '=', self.campaign.id)])
        self.assertEqual(len(cards), 2)
        self.assertListEqual(cards.mapped('image'), [False] * 2)
        self.assertListEqual(cards.mapped('share_status'), [False] * 2)
        self.assertEqual(set(cards.mapped('res_id')), set(self.concert_performances.ids))

    @users('marketing_card_user')
    @warmup
    @mute_logger('odoo.addons.mail.models.mail_mail')
    def test_campaign_send_mailing(self):
        self.campaign = self.campaign.with_user(self.env.user)
        self.env.user.sudo().groups_id += self.env.ref('mass_mailing.group_mass_mailing_user')
        partners = self.env['res.partner'].sudo().create([{'name': f'Part{n}', 'email': f'partn{n}@test.lan'} for n in range(20)])
        performances = self.env['card.test.event.performance'].create([
            {
                'name': f"Perf{n}",
                'event_id': self.events[0].id,
                'partner_id': partner.id,
            } for n, partner in enumerate(partners)
        ])
        with self.mock_image_renderer(), self.mock_mail_gateway(), self.assertQueryCount(238):
            mailing = self.env['mailing.mailing'].create({
                'name': 'Test Marketing Card Mailing',
                'body_html': f'<a href="/cards/{self.campaign.id}/preview"><img src="/cards/{self.campaign.id}/card.jpg"/></a>',
                'mailing_domain': repr([('partner_id.email', 'like', 'partn')]),
                'mailing_model_id': self.env['ir.model']._get_id(performances._name),
                'subject': 'The show is about to start!',
            })
            mailing.action_send_mail()
            # create the cards
            self.cr.precommit.run()

        self.assertFalse(self._wkhtmltoimage_bodies)
        self.assertEqual(self.env['card.card'].search_count([('campaign_id', '=', self.campaign.id)]), 20)
        self.assertEqual(len(self._mails), 20)
        for sent_mail in self._mails:
            record_id = int(sent_mail['object_id'].split('-')[0])
            preview_url = f"{self.campaign.get_base_url()}/cards/{self.campaign.id}/{record_id}/{self.campaign._generate_card_hash_token(record_id)}/preview"
            image_url = f"{self.campaign.get_base_url()}/cards/{self.campaign.id}/{record_id}/{self.campaign._generate_card_hash_token(record_id)}/card.jpg"
            self.assertIn(f'<a href="{preview_url}"><img src="{image_url}"/></a>', sent_mail['body'])


@tagged('post_install', '-at_install')
class TestMarketingCardRouting(HttpCase, MarketingCardCommon):

    def test_campaign_stats(self):
        partners = self.env['res.partner'].create([{'name': f'Part{n}', 'email': 'partn{n}@test.lan'} for n in range(20)])
        performances = self.env['card.test.event.performance'].create([
            {
                'name': f"Perf{n}",
                'event_id': self.events[0].id,
                'partner_id': partner.id,
            } for n, partner in enumerate(partners)
        ])
        cards = self.campaign._get_or_create_cards_from_res_ids(performances.ids)
        self.assertEqual(len(cards), 20)
        self.assertEqual(self.campaign.card_count, 20)
        self.assertEqual(self.campaign.card_click_count, 0)
        self.assertEqual(self.campaign.card_share_count, 0)
        self.assertListEqual(cards.mapped('image'), [False] * 20)
        self.assertListEqual(cards.mapped('share_status'), [False] * 20)

        # user checks preview
        self.url_open(self.campaign._get_preview_url_from_res_id(performances[0].id))
        image_request_headers = self.url_open(cards[0]._get_card_url(small=True)).headers
        self.assertEqual(image_request_headers.get('Content-Type'), 'image/jpeg')
        self.assertTrue(image_request_headers.get('Content-Length'))
        self.assertTrue(cards[0].image)
        self.assertEqual(cards[0].share_status, 'visited')
        self.campaign.flush_recordset()
        self.assertEqual(self.campaign.card_count, 20)
        self.assertEqual(self.campaign.card_click_count, 1)
        self.assertEqual(self.campaign.card_share_count, 0, 'A regular user fetching the card should not count as a share.')

        # user publishes redirect url, prompting social network crawler to check open-graph data
        self.opener.headers['User-Agent'] = SOCIAL_NETWORK_USER_AGENTS[0]
        opengraph_view = html.fromstring(self.url_open(cards[0]._get_redirect_url()).content)
        self.assertTrue(opengraph_view is not None, 'Crawler should get a valid html page as response')
        opengraph_image_url_element = opengraph_view.find('.//meta[@property="og:image"]')
        self.assertTrue(opengraph_image_url_element is not None, 'page should contain image opengraph node')
        opengraph_image_url = opengraph_image_url_element.attrib.get('content')
        self.assertTrue(opengraph_image_url)
        self.assertEqual(opengraph_image_url, cards[0]._get_card_url())

        image_request_headers = self.url_open(opengraph_image_url).headers
        self.assertEqual(image_request_headers.get('Content-Type'), 'image/jpeg')
        self.assertTrue(image_request_headers.get('Content-Length'))

        self.campaign.flush_recordset()
        self.assertEqual(self.campaign.card_count, 20)
        self.assertEqual(self.campaign.card_click_count, 1)
        self.assertEqual(self.campaign.card_share_count, 1, "A crawler fetching the card is considered a share.")
        self.assertEqual(cards[0].share_status, 'shared')

        # someone clicks the redirect url on the social network platform
        self.assertEqual(self.campaign.target_url_click_count, 0)
        self.opener.headers['User-Agent'] = 'someuseragent'
        redirect_response = self.url_open(cards[0]._get_redirect_url(), allow_redirects=False)
        self.assertEqual(redirect_response.status_code, 303)
        self.assertEqual(redirect_response._next.url, self.campaign.link_tracker_id.short_url)
        self.opener.send(redirect_response._next, allow_redirects=False)
        self.assertEqual(self.campaign.target_url_click_count, 1)

        cards[1:10].share_status = 'visited'
        cards[10:].share_status = 'shared'
        self.assertEqual(self.campaign.card_count, 20)
        self.assertEqual(self.campaign.card_click_count, 20, 'Shared cards are considered implicitly visited')
        self.assertEqual(self.campaign.card_share_count, 11)
