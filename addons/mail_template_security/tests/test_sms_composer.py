# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from .common import TestMailTemplateSecurityCommon

from odoo.tests import Form
from odoo.exceptions import AccessError


class TestSmsComposer(TestMailTemplateSecurityCommon):
    def test_sms_template_acl(self):
        # Sanity check
        self.assertTrue(self.user_admin.has_group('mail_template_security.group_mail_template_editor'))
        self.assertFalse(self.user_employee.has_group('mail_template_security.group_mail_template_editor'))

        # Group System can create / write / unlink sms template
        sms_template = self.env['sms.template'].with_user(self.user_admin).create({
            'name': 'Test template',
            'body': '${1 + 2}',
            'model_id': self.env['ir.model'].search([('model', '=', 'res.partner')]).id,
        })
        self.assertEqual(sms_template.name, 'Test template')

        sms_template.with_user(self.user_admin).name = 'New name'
        self.assertEqual(sms_template.name, 'New name')

        # Standard employee can not
        with self.assertRaises(AccessError):
            self.env['sms.template'].with_user(self.user_employee).create({
                'name': 'Test template',
                'body': '${1 + 2}',
                'model_id': self.env['ir.model'].search([('model', '=', 'res.partner')]).id,
            })

        with self.assertRaises(AccessError):
            sms_template.with_user(self.user_employee).name = 'Test write'

        with self.assertRaises(AccessError):
            sms_template.with_user(self.user_employee).unlink()

    def test_sms_composer_security(self):
        partner = self.env['res.partner'].search([], limit=1)

        sms_template = self.env['sms.template'].create({
            'name': 'Test template',
            'body': '${object.name}',
            'model_id': self.env['ir.model'].search([('model', '=', 'res.partner')]).id,
        })

        sms_composer = self.env['sms.composer'].with_user(self.user_employee).with_context(
            default_res_model='res.partner',
            default_res_id=partner.id,
            default_composition_mode='comment',
            default_template_id=sms_template.id,
        ).create({})

        sms_composer._onchange_template_id()

        self.assertEqual(sms_composer.body, partner.name, 'Simple user should be able to render SMS template')

        sms_composer.composition_mode = 'mass'
        sms_composer._onchange_template_id()
        self.assertEqual(sms_composer.body, '${object.name}', 'In mass mode, we should not render the template')

        body = sms_composer._prepare_body_values(partner)[partner.id]
        self.assertEqual(body, partner.name, 'In mass mode, if the user did not change the body, he should be able to render it')

        sms_composer.body = 'New body: ${4 + 9}'
        with self.assertRaises(AccessError, msg='User should not be able to write new Jinja code'):
            sms_composer._prepare_body_values(partner)
