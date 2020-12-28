
# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.


from .common import TestMailTemplateSecurityCommon

from odoo.tests import Form
from odoo.exceptions import AccessError


class TestMailTemplate(TestMailTemplateSecurityCommon):
    def test_mail_template_acl(self):
        # Sanity check
        self.assertTrue(self.user_admin.has_group('mail_template_security.group_mail_template_editor'))
        self.assertFalse(self.user_employee.has_group('mail_template_security.group_mail_template_editor'))

        # Group System can create / write / unlink mail template
        mail_template = self.env['mail.template'].with_user(self.user_admin).create({'name': 'Test template'})
        self.assertEqual(mail_template.name, 'Test template')

        mail_template.with_user(self.user_admin).name = 'New name'
        self.assertEqual(mail_template.name, 'New name')

        # Standard employee can not
        with self.assertRaises(AccessError):
            self.env['mail.template'].with_user(self.user_employee).create({})

        with self.assertRaises(AccessError):
            mail_template.with_user(self.user_employee).name = 'Test write'

        with self.assertRaises(AccessError):
            mail_template.with_user(self.user_employee).unlink()

    def test_template_render_static(self):
        """Test that we render correctly a static Jinja template (so just XML basically)."""
        model = 'res.partner'
        res_ids = self.env[model].search([], limit=1).ids
        MailTemplate = self.env['mail.template']

        # Static template
        template_txt = """
            <h1>This is a test</h1>
            <p>Little paragraph</p>
            <img src="https://url.com"/>
        """
        result = MailTemplate.with_user(self.user_employee)._render_template(template_txt, model, res_ids)[res_ids[0]]
        self.assertEqual(result, template_txt)

    def test_is_jinja_template_code_block(self):
        """Test if we correctly detect static template."""
        model = 'res.partner'
        res_ids = self.env[model].search([], limit=1).ids
        MailTemplate = self.env['mail.template']
        template_txt = """
            <p>${13 + 13}</p>
            <h1>This is a test</h1>
        """
        with self.assertRaises(AccessError, msg='Simple user should not be able to render Jinja code'):
            MailTemplate.with_user(self.user_employee)._render_template(template_txt, model, res_ids)

        result = MailTemplate.with_user(self.user_admin)._render_template(template_txt, model, res_ids)[res_ids[0]]
        self.assertIn('26', result, 'Template Editor should be able to render Jinja code')

    def test_is_jinja_template_condition_block(self):
        """Test if we correctly detect condition block (which might contains code)."""
        model = 'res.partner'
        res_ids = self.env[model].search([], limit=1).ids
        MailTemplate = self.env['mail.template']
        template_txt = """
            <b>Test</b>
            % if False:
                <b>Code not executed</b>
            % endif
        """
        with self.assertRaises(AccessError, msg='Simple user should not be able to render Jinja code'):
            MailTemplate.with_user(self.user_employee)._render_template(template_txt, model, res_ids)

        result = MailTemplate.with_user(self.user_admin)._render_template(template_txt, model, res_ids)[res_ids[0]]
        self.assertNotIn('Code not executed', result, 'The condition block did not work')

    def test_mail_compose_message_content_from_template(self):
        mail_template = self.env['mail.template'].create({
            'name': 'Test template',
            'subject': '${1 + 5}',
            'partner_to': '${object.id}',
            'lang': '${object.lang}',
            'auto_delete': True,
            'model_id': self.ref('base.model_res_partner'),
        })

        MailComposeMessage = self.env['mail.compose.message'].with_user(self.user_employee)

        form = Form(MailComposeMessage)
        form.template_id = mail_template
        mail_compose_message = form.save()

        self.assertEqual(mail_compose_message.subject, '6', 'We must trust mail template values')
