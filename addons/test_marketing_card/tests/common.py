import base64
from contextlib import contextmanager
from unittest.mock import patch

from odoo.tests import BaseCase, TransactionCase, HttpCase
from odoo.addons.base.models.ir_actions_report import IrActionsReport
from odoo.addons.base.models.ir_qweb import IrQWeb
from odoo.addons.mail.tests.common import MailCase, mail_new_test_user

VALID_JPEG = base64.b64decode('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/yQALCAABAAEBAREA/8wABgAQEAX/2gAIAQEAAD8A0s8g/9k=')

ROLES = ('background', 'header', 'subheader', 'section_1', 'subsection_1', 'subsection_2', 'button', 'image_1', 'image_2')

def neuter_image_render(func):
    def patched(self, *args, **kwargs):
        with self.mock_image_renderer(collect_params=False):
            return func(self, *args, **kwargs)
    return patched

class MockImageRender(BaseCase):
    @contextmanager
    def mock_image_renderer(self, collect_params=True):
        self._wkhtmltoimage_bodies = []

        def _ir_actions_report_build_run_wkhtmltoimage(model, bodies, width, height, image_format="jpg"):
            if collect_params:
                self._wkhtmltoimage_bodies.extend(bodies)
            return [VALID_JPEG] * len(bodies)

        with patch.object(IrActionsReport, '_run_wkhtmltoimage', _ir_actions_report_build_run_wkhtmltoimage):
            yield


class MarketingCardCommon(TransactionCase, MockImageRender):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()

        cls.company = cls.env['res.company'].create({
            'country_id': cls.env.ref("base.be").id,
            'email': 'your.company@example.',
            'name': 'YourTestCompany',
        })
        cls.marketing_card_manager = mail_new_test_user(
            cls.env,
            company_id=cls.company.id,
            email='manager.marketing.card@example.com',
            login='marketing_card_manager',
            groups='marketing_card.marketing_card_group_manager',
            name='Marketing Card Manager',
        )
        cls.marketing_card_user = mail_new_test_user(
            cls.env,
            company_id=cls.company.id,
            email='user.marketing.card@example.com',
            login='marketing_card_user',
            groups='marketing_card.marketing_card_group_user',
            name='Marketing Card User',
        )
        cls.marketing_card_user_2 = cls.marketing_card_user.copy({
            'email': 'user2.marketing.card@example.com',
            'login': 'marketing_card_user_2',
            'name': 'Marketing Card User 2',
        })
        cls.system_admin = mail_new_test_user(
            cls.env,
            company_id=cls.company.id,
            email='system.marketing.card@example.com',
            login='marketing_card_system_admin',
            groups='base.group_system',
            name='System Admin',
        )

        cls.partners = cls.env['res.partner'].create([
            {'name': 'John', 'email': 'john93@trombino.scope'},
            {'name': 'Bob', 'email': 'bob@justbob.me'},
        ])

        cls.tag_free, cls.tag_open = cls.env['card.test.event.location.tag'].create([
            {'name': 'Free Access'}, {'name': 'Open Space'},
        ])
        cls.location_plaza, cls.location_square = cls.env['card.test.event.location'].create([
            {'name': 'Green Plaza', 'tag_ids': [(4, cls.tag_free.id, 0), (4, cls.tag_open.id, 0)]},
            {'name': 'Red Square'},
        ])
        cls.events = cls.env['card.test.event'].create([
            {'name': 'Concert', 'location_id': cls.location_plaza.id},
            {'name': 'Debate', 'location_id': cls.location_square.id},
        ])
        cls.concert_performances = cls.env['card.test.event.performance'].create([
            {'name': "John's Holiday", 'event_id': cls.events[0].id, 'partner_id': cls.partners[0].id},
            {'name': "Bob's (grand) slam", 'event_id': cls.events[0].id, 'partner_id': cls.partners[1].id},
        ])

        cls.card_template = cls.env['card.template'].create({
            'name': 'Test Template',
            'template_variant': 'test_1',
        })

        card_element_commands = [
            (0, 0, {'card_element_role': 'subheader', 'value_type': 'field', 'field_path': 'name'}),
            (0, 0, {'card_element_role': 'section_1', 'value_type': 'field', 'field_path': 'event_id'}),
            (0, 0, {'card_element_role': 'subsection_1', 'value_type': 'field', 'field_path': 'event_id.location_id'}),
            (0, 0, {'card_element_role': 'subsection_2', 'value_type': 'field', 'field_path': 'event_id.location_id.tag_ids'}),
            (0, 0, {'card_element_role': 'image_1', 'value_type': 'field', 'field_path': 'event_id.image'}),
        ]
        card_element_commands.extend([
            command
            for command in cls.env['card.campaign'].default_get(['card_element_ids'])['card_element_ids']
            if command[2]['card_element_role'] not in set(command[2]['card_element_role'] for command in card_element_commands)
        ])
        cls.campaign = cls.env['card.campaign'].create({
            'name': 'Test Campaign',
            'card_element_ids': card_element_commands,
            'card_template_id': cls.card_template.id,
            'res_model': cls.concert_performances._name,
            'post_suggestion': 'Come see my show!',
            'reward_message': """<p>Thanks for sharing!</p>""",
            'reward_target_url': f"{cls.env['card.campaign'].get_base_url()}/share-rewards/2039-sharer-badge/",
            'target_url': cls.env['card.campaign'].get_base_url(),
        })

    @staticmethod
    def _extract_values_from_document(rendered_document):
        return {
            'body': rendered_document.find('.//body'),
            'header': rendered_document.find('.//p[@id="header"]'),
            'subheader': rendered_document.find('.//p[@id="subheader"]'),
            'section_1': rendered_document.find('.//p[@id="section_1"]'),
            'subsection_1': rendered_document.find('.//p[@id="subsection_1"]'),
            'subsection_2': rendered_document.find('.//p[@id="subsection_2"]'),
            'button': rendered_document.find('.//p[@id="button"]'),
            'image_1': rendered_document.find('.//img[@id="image_1"]'),
            'image_2': rendered_document.find('.//img[@id="image_2"]'),
        }
