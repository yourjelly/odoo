# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.test_mail.tests import common
from odoo.addons.test_mail.tests.common import mail_new_test_user
from odoo.tests import tagged


@tagged('mass_mail')
class MassMailingCase(common.MockEmails, common.BaseFunctionalTest):

    @classmethod
    def setUpClass(cls):
        super(MassMailingCase, cls).setUpClass()

        # be sure for some common data
        cls.user_employee.write({
            'login': 'emp',
        })

        cls.user_marketing = mail_new_test_user(
            cls.env, login='marketing',
            groups='base.group_user,mass_mailing.group_mass_mailing_user',
            name='Martial Marketing', signature='--\nMartial')

        # The tests might run before installing "mail_template_security_mass_mailing"
        # So we need to manually add the group as it will not be automatically be added with the group "Mailing User"
        group_mail_template_editor = cls.env.ref('mail_template_security.group_mail_template_editor', raise_if_not_found=False)
        if not cls.user_marketing.has_group('mail_template_security.group_mail_template_editor') and group_mail_template_editor:
            cls.user_marketing.groups_id |= group_mail_template_editor
