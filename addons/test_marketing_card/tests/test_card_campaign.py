from datetime import datetime, timedelta
from lxml import html
from markupsafe import Markup

from odoo.tools import mute_logger
from odoo.tests.common import users, warmup
from odoo.tests import Form, tagged, TransactionCase, MailCase, HttpCase

from .common import MarketingCardCommon, neuter_image_render, ROLES


class TestMarketingCardRender(MarketingCardCommon):

    @neuter_image_render
    @users('marketing_card_user')
    def test_campaign(self):
        campaign = self.env['card.campaign'].create({
            'name': 'Test Campaign',
            'card_template_id': self.card_template.id,
            'res_model': self.concert_performances._name,
            'post_suggestion': 'Come see my show!',
            'reward_message': """<p>Thanks for sharing!</p>""",
            'reward_target_url': 'https://www.event-website.lan/share-rewards/2039-sharer-badge/',
            'target_url': 'https://www.event-website.lan/',
        })
        self.assertListEqual(campaign.card_element_ids.mapped('card_element_role'), list(ROLES))
        self.assertEqual(set(campaign.card_element_ids.mapped('value_type')), {'static'})

        self.assertFalse(campaign.preview_record_url)

        element_by_role = campaign.card_element_ids.grouped('card_element_role')

        element_by_role['subheader'].write({
            'value_type': 'field',
            'field_path': 'name',
        })
        element_by_role['section_1'].write({
            'value_type': 'field',
            'field_path': 'event_id',
        })
        element_by_role['subsection_1'].write({
            'value_type': 'field',
            'field_path': 'event_id.location_id',
        })
        element_by_role['subsection_2'].write({
            'value_type': 'field',
            'field_path': 'event_id.location_id.tag_ids',
        })
        element_by_role['image_1'].write({
            'value_type': 'field',
            'field_path': 'event_id.image',
        })

        with self.mock_image_renderer():
            element_by_role['header'].write({
                'card_element_text': 'Come and See',
                'text_color': '#CC8888',
            })
            self.assertTrue(campaign.image_preview)

        self.assertEqual(self._ir_qweb_values[0]['card_campaign'], campaign)
        self.assertDictEqual(self._ir_qweb_values[0]['preview_values'], {'header': 'Title', 'subheader': 'Subtitle'})
        role_values = self._extract_values_from_document(html.fromstring(self._wkhtmltoimage_bodies[0]))
        self.assertEqual(role_values['body'].attrib['style'], "background-image: url('data:image/png;base64,');")
        self.assertEqual(role_values['header'].text, 'Come and See')
        self.assertEqual(role_values['header'].attrib['style'], 'color: #CC8888;')
        self.assertEqual(role_values['subheader'].text, '[name]')
        self.assertEqual(role_values['section_1'].text, '[event_id]')
        self.assertEqual(role_values['subsection_1'].text, '[event_id.location_id]')
        self.assertEqual(role_values['subsection_2'].text, '[event_id.location_id.tag_ids]')
        self.assertFalse(role_values['button'].text)
        self.assertTrue(role_values['image_1'].attrib['src'], 'Placeholder image should be displayed')
        self.assertFalse(role_values['image_2'].attrib['src'])

        # first record

        with self.mock_image_renderer():
            campaign.preview_record_ref = self.concert_performances[0]
            self.assertTrue(campaign.image_preview)
        self.assertEqual(self._ir_qweb_values[0]['card_campaign'], campaign)
        self.assertNotIn('preview_values', self._ir_qweb_values[0])
        role_values = self._extract_values_from_document(html.fromstring(self._wkhtmltoimage_bodies[0]))
        self.assertEqual(role_values['body'].attrib['style'], "background-image: url('data:image/png;base64,');")
        self.assertEqual(role_values['header'].text, 'Come and See')
        self.assertEqual(role_values['header'].attrib['style'], 'color: #CC8888;')
        self.assertEqual(role_values['subheader'].text, "John's Holiday")
        self.assertEqual(role_values['section_1'].text, 'Concert')
        self.assertEqual(role_values['subsection_1'].text, 'Green Plaza')
        self.assertEqual(role_values['subsection_2'].text, 'Free Access Open Space')
        self.assertFalse(role_values['button'].text)
        # even if there is no image, we shouldn't display a placeholder image
        self.assertFalse(campaign.preview_record_ref.mapped(element_by_role['image_1'].field_path)[0])
        self.assertFalse(role_values['image_1'].attrib['src'], 'Placeholder image should not be displayed')
        self.assertFalse(role_values['image_2'].attrib['src'])

        campaign_url_john = campaign.preview_record_url
        self.assertTrue(campaign_url_john)

        # second record, modified tags

        with self.mock_image_renderer():
            self.concert_performances[1].event_id.location_id.tag_ids = self.tag_open
            campaign.preview_record_ref = self.concert_performances[1]
            self.assertTrue(campaign.image_preview)
        self.assertEqual(self._ir_qweb_values[0]['card_campaign'], campaign)
        self.assertNotIn('preview_values', self._ir_qweb_values[0])
        role_values = self._extract_values_from_document(html.fromstring(self._wkhtmltoimage_bodies[0]))
        self.assertEqual(role_values['body'].attrib['style'], "background-image: url('data:image/png;base64,');")
        self.assertEqual(role_values['header'].text, 'Come and See')
        self.assertEqual(role_values['header'].attrib['style'], 'color: #CC8888;')
        self.assertEqual(role_values['subheader'].text, "Bob's (grand) slam")
        self.assertEqual(role_values['section_1'].text, 'Concert')
        self.assertEqual(role_values['subsection_1'].text, 'Green Plaza')
        self.assertEqual(role_values['subsection_2'].text, 'Open Space')
        self.assertFalse(role_values['button'].text)
        # even if there is no image, we shouldn't display a placeholder image
        self.assertFalse(campaign.preview_record_ref.mapped(element_by_role['image_1'].field_path)[0])
        self.assertFalse(role_values['image_1'].attrib['src'], 'Placeholder image should not be displayed')
        self.assertFalse(role_values['image_2'].attrib['src'])


        self.assertNotEqual(campaign_url_john, campaign.preview_record_url)

        # update previewed record fields

        with self.mock_image_renderer():
            campaign.preview_record_ref.name = 'An updated name'
            self.assertTrue(campaign.image_preview)
        self.assertFalse(self._ir_qweb_values, 'Updating the preview record does not refresh the preview.')

        # url remains consistent

        campaign.preview_record_ref = self.concert_performances[0]
        self.assertEqual(campaign_url_john, campaign.preview_record_url)

class TestMarketingCardMail(MailCase, MarketingCardCommon):

    def 

class TestMarketingCardRouting(HttpCase, MarketingCardCommon):
