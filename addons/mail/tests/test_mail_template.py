# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests import Form, users
from odoo.exceptions import AccessError
from odoo.addons.mail.tests.common import MailCommon


class TestMailTemplate(MailCommon):
    @classmethod
    def setUpClass(cls):
        super(TestMailTemplate, cls).setUpClass()
        cls.user_employee.groups_id -= cls.env.ref('mail.group_mail_template_editor')

        cls.mail_template = cls.env['mail.template'].create({
            'name': 'Test template',
            'subject': '{{ 1 + 5 }}',
            'body_html': '<t t-out="4 + 9"/>',
            'lang': '{{ object.lang }}',
            'auto_delete': True,
            'model_id': cls.env.ref('base.model_res_partner').id,
        })

    @users('employee')
    def test_mail_compose_message_content_from_template(self):
        form = Form(self.env['mail.compose.message'])
        form.template_id = self.mail_template
        mail_compose_message = form.save()

        self.assertEqual(mail_compose_message.subject, '6', 'We must trust mail template values')

    @users('employee')
    def test_mail_compose_message_content_from_template_mass_mode(self):
        mail_compose_message = self.env['mail.compose.message'].create({
            'composition_mode': 'mass_mail',
            'model': 'res.partner',
            'template_id': self.mail_template.id,
            'subject': '{{ 1 + 8 }}',  # not the same subject as the template
        })

        values = mail_compose_message.get_mail_values(self.partner_employee.ids)

        self.assertEqual(values[self.partner_employee.id]['subject'], '9', 'Must have rendered the template')
        self.assertIn('13', values[self.partner_employee.id]['body_html'], 'Must have rendered the template')

    def test_mail_template_acl(self):
        # Sanity check
        self.assertTrue(self.user_admin.has_group('mail.group_mail_template_editor'))
        self.assertFalse(self.user_employee.has_group('mail.group_mail_template_editor'))

        # Group System can create / write / unlink mail template
        mail_template = self.env['mail.template'].with_user(self.user_admin).create({'name': 'Test template'})
        self.assertEqual(mail_template.name, 'Test template')

        mail_template.with_user(self.user_admin).write({
            'name': 'New name',
            'is_system_template': True,
        })
        self.assertEqual(mail_template.name, 'New name')
        self.assertTrue(mail_template.is_system_template)

        # Standard employee can not
        with self.assertRaises(AccessError):
            self.env['mail.template'].with_user(self.user_employee).create({'is_system_template': True})

        with self.assertRaises(AccessError):
            mail_template.with_user(self.user_employee).name = 'Test write'
