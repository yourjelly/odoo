# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.mail.tests.common import TestMail
from odoo.tools import mute_logger


class test_message_compose(TestMail):

    def test_OO_mail_mail_tracking(self):
        """ Tests designed for mail_mail tracking (opened, replied, bounced) """
        pass

    @mute_logger('odoo.addons.mail.models.mail_mail')
    def test_mass_mail_blacklist_test(self):
        MassMailingContacts = self.env['mail.mass_mailing.contact']
        MassMailing = self.env['mail.mass_mailing']
        MailBlacklist = self.env['mail.blacklist']

        # create mailing contact record
        self.mailing_contact_1 = MassMailingContacts.create({'name': 'test email 1', 'email': 'test1@email.com'})
        self.mailing_contact_2 = MassMailingContacts.create({'name': 'test email 2', 'email': 'test2@email.com'})
        self.mailing_contact_3 = MassMailingContacts.create({'name': 'test email 3', 'email': 'test3@email.com'})
        self.mailing_contact_4 = MassMailingContacts.create({'name': 'test email 4', 'email': 'test4@email.com'})
        self.mailing_contact_5 = MassMailingContacts.create({'name': 'test email 5', 'email': 'test5@email.com'})

        # create blacklist record
        MailBlacklist.create({'email': self.mailing_contact_3.email})
        MailBlacklist.create({'email': self.mailing_contact_4.email})

        # create mass mailing record
        self.mass_mailing = MassMailing.create({
                    'name': 'test',
                    'mailing_model': 'mail.mass_mailing.contact',
                    'body_html': 'This is mass mail marketing demo'})
        self.mass_mailing.put_in_queue()
        self.mass_mailing._process_mass_mailing_queue()
        self.assertEqual(self.mass_mailing.failed, 3, 'blacklist failed email number incorrect, should be equals to 3')
