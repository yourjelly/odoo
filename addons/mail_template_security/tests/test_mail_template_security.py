
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
            'body_html': '${13 + 1}',
            'partner_to': '${3 + 4}',
            'auto_delete': True,
            'model_id': self.ref('base.model_res_partner'),
        })

        MailComposeMessage = self.env['mail.compose.message'].with_user(self.user_employee)

        form = Form(MailComposeMessage)
        form.template_id = mail_template
        mail_compose_message = form.save()

        self.assertEqual(mail_compose_message.subject, '6', 'We must trust mail template values')
        self.assertIn('14', mail_compose_message.body, 'We must trust mail template values')

    def test_mail_compose_message_content_from_template_mass_mode(self):
        self.user_employee.signature = 'this is a test ${998 + 1}'

        model = 'res.partner'
        res_ids = self.env[model].search([], limit=1).ids
        mail_template = self.env['mail.template'].create({
            'name': 'Test template',
            'email_from': '${5+6}',
            'subject': '${1 + 5}',
            'body_html': '${2 + 5}',
            'partner_to': '${object.id}',
            'lang': '${object.lang}',
            'auto_delete': True,
            'model_id': self.ref('base.model_res_partner'),
            'user_signature': True,
        })

        MailComposeMessage = self.env['mail.compose.message'].with_user(self.user_employee)

        form = Form(MailComposeMessage)
        form.composition_mode = 'mass_mail'
        form.reply_to = 'test@example.com'
        form.template_id = mail_template
        form.model = model
        mail_compose_message = form.save()

        self.assertEqual(mail_compose_message.subject, '${1 + 5}', 'Should not render the subject in mass mail mode')
        self.assertIn('${2 + 5}', mail_compose_message.body, 'Should not render the body in mass mail mode')
        self.assertIn('this is a test ${998 + 1}', mail_compose_message.body, 'Should not render the user signature')

        result = mail_compose_message.render_message(res_ids)[res_ids[0]]
        self.assertEqual(result['email_from'], '11', 'We must trust mail template values')
        self.assertEqual(result['subject'], '6', 'We must trust mail template values')
        self.assertIn('7', result['body'], 'We must trust mail template values')
        self.assertIn('this is a test ${998 + 1}', result['body'], 'Should not render the user signature')

    def test_mail_compose_message_mass_mode_editing(self):
        model = 'res.partner'
        res_ids = self.env[model].search([], limit=1).ids
        mail_template = self.env['mail.template'].create({
            'name': 'Test template',
            'subject': '${1 + 5}',
            'body_html': '${2 + 5}',
            'partner_to': '${object.id}',
            'lang': '${object.lang}',
            'auto_delete': True,
            'model_id': self.ref('base.model_res_partner'),
        })

        MailComposeMessage = self.env['mail.compose.message'].with_user(self.user_employee)

        form = Form(MailComposeMessage)
        form.composition_mode = 'mass_mail'
        form.reply_to = 'test@example.com'
        form.template_id = mail_template
        form.body = 'New custom template ${4+5}'
        form.model = model
        mail_compose_message = form.save()

        with self.assertRaises(AccessError, msg='Simple user should not be able to render Jinja code'):
            mail_compose_message.render_message(res_ids)[res_ids[0]]
