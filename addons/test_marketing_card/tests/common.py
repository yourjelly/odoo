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
        original_ir_qweb_render = IrQWeb._render
        self._ir_qweb_values = []
        self._wkhtmltoimage_bodies = []

        def _ir_qweb_render(model, template, values=None, **options):
            if collect_params:
                self._ir_qweb_values.append(values)
            return original_ir_qweb_render(model, template, values=values, **options)

        def _ir_actions_report_build_run_wkhtmltoimage(model, bodies, width, height, image_format="jpg"):
            if collect_params:
                self._wkhtmltoimage_bodies.extend(bodies)
            return [VALID_JPEG] * len(bodies)

        with patch.object(IrActionsReport, '_run_wkhtmltoimage', _ir_actions_report_build_run_wkhtmltoimage):
            with patch.object(IrQWeb, '_render', _ir_qweb_render):
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
            'body': """
<t t-set="role_values" t-value="card_campaign._get_card_element_values(object, preview_values)"/>
<t t-set="elements" t-value="card_campaign.card_element_ids.grouped('card_element_role')"/>
    <style>
        p { margin: 1px };
        body { width: 100%; height: 100%; };
    </style>
    <div id="body" t-attf-style="background-image: url('data:image/png;base64,{{role_values['background']}}');">
        <p id="header" t-out="role_values['header']" t-att-style="'color: %s;' % elements['header'].text_color"></p>
        <p id="subheader" t-out="role_values['subheader']" t-att-style="'color: %s;' % elements['subheader'].text_color"></p>
        <p id="section_1" t-out="role_values['section_1']" t-att-style="'color: %s;' % elements['section_1'].text_color"></p>
        <p id="subsection_1" t-out="role_values['subsection_1']" t-att-style="'color: %s;' % elements['subsection_1'].text_color"></p>
        <p id="subsection_2" t-out="role_values['subsection_2']" t-att-style="'color: %s;' % elements['subsection_2'].text_color"></p>
        <p id="subsection_3" t-out="role_values['button']" t-att-style="'color: %s;' % elements['button'].text_color"></p>
        <p id="button" t-out="role_values['button']" t-att-style="'color: %s;' % elements['button'].text_color"></p>
        <img id="image_1" t-att-src="role_values['image_1']"></p>
        <img id="image_2" t-att-src="role_values['image_2']"></p>
    </div>
</html>
            """,
        })

    @staticmethod
    def _extract_values_from_document(rendered_document):
        return {
            'body': rendered_document.find('.//div[@id="body"]'),
            'header': rendered_document.find('.//p[@id="header"]'),
            'subheader': rendered_document.find('.//p[@id="subheader"]'),
            'section_1': rendered_document.find('.//p[@id="section_1"]'),
            'subsection_1': rendered_document.find('.//p[@id="subsection_1"]'),
            'subsection_2': rendered_document.find('.//p[@id="subsection_2"]'),
            'button': rendered_document.find('.//p[@id="button"]'),
            'image_1': rendered_document.find('.//img[@id="image_1"]'),
            'image_2': rendered_document.find('.//img[@id="image_2"]'),
        }
