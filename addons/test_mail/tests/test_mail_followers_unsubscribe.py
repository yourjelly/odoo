# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import re
from urllib.parse import urlparse, urlencode, parse_qsl

from odoo import tools
from odoo.addons.test_mail.tests.test_message_post import TestMessagePostCommon
from odoo.tests import tagged
from odoo.tests import users
from odoo.tests.common import HttpCase
from odoo.tools import mute_logger


@tagged('mail_followers', 'post_install', '-at_install')
class UnfollowFromInboxTest(TestMessagePostCommon):
    """Test unfollow mechanism from inbox (server part)."""

    @users('employee')
    def test_inbox_notification_follower(self):
        """Check follow-up information for displaying inbox messages used to implement "unfollow" in the inbox.

        Note that the actual mechanism to unfollow a record from a message is tested in the client part.
        """
        self.user_employee.write({'notification_type': 'inbox'})
        test_record = self.env['mail.test.simple'].browse(self.test_record.ids)
        test_record_admin = test_record.with_user(self.user_admin)

        # Non follow-up notification (the user doesn't follow the record)
        test_message = self.env['mail.message'].browse(self.test_message.ids).copy()
        recipients_data = self._generate_notify_recipients(self.partner_employee)
        test_record_admin._notify_thread_by_inbox(test_message, recipients_data, force_send=False)
        messages_formatted = list(filter(
            lambda m: m['id'] == test_message.id,
            self.env['mail.message']._message_fetch(domain=[('needaction', '=', True)]).message_format()))
        self.assertEqual(len(messages_formatted), 1)
        self.assertFalse(messages_formatted[0]['notifications'][0]['is_follow_up'])
        self.assertFalse(messages_formatted[0].get('user_follower_id'))

        # Follow-up notification
        test_record_admin._message_subscribe(partner_ids=self.partner_employee.ids)
        message = test_record_admin.message_post(body='test message',
                                                 subtype_id=self.env.ref('mail.mt_comment').id)
        messages_formatted = list(filter(
            lambda m: m['id'] == message.id,
            self.env['mail.message']._message_fetch(domain=[('needaction', '=', True)]).message_format()))
        self.assertEqual(len(messages_formatted), 1)
        self.assertTrue(messages_formatted[0]['notifications'][0]['is_follow_up'])
        follower_id = messages_formatted[0]['user_follower_id']
        self.assertTrue(follower_id)
        follower = self.env['mail.followers'].browse([follower_id])
        self.assertEqual(follower.res_model, test_record._name)
        self.assertEqual(follower.res_id, test_record.id)
        self.assertEqual(follower.partner_id, self.partner_employee)
        test_record.with_user(self.user_admin).message_unsubscribe(partner_ids=self.partner_employee.ids)


@tagged('mail_followers', 'post_install', '-at_install')
class UnfollowFromEmailTest(TestMessagePostCommon, HttpCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.test_record = cls.env['mail.test.simple'].browse(cls.test_record.ids)
        cls.test_record_admin = cls.test_record.with_user(cls.user_admin)
        cls.test_record_unfollow = cls.env['mail.test.simple.unfollow'].create({'name': 'unfollow'})
        cls.test_record_unfollow_admin = cls.test_record_unfollow.with_user(cls.user_admin)
        cls.user_employee.write({'notification_type': 'email'})
        cls.partner_admin = cls.user_admin.partner_id
        cls.partner_without_user = cls.env['res.partner'].create({
            'name': 'Dave',
            'email': 'dave@odoo.com',
        })

    def test_initial_data(self):
        """Test some initial value."""
        self.assertTrue(self.user_employee._is_internal())
        record_employee = self.test_record.with_user(self.user_employee)
        record_employee.check_access_rights('read')
        record_employee.check_access_rule('read')

    def _extract_unfollow_url(self, mail_body):
        urls = {link_url for _, link_url, _, _ in re.findall(tools.HTML_TAG_URL_REGEX, mail_body)
                if '/mail/unfollow' in link_url}
        n_url = len(urls)
        self.assertLessEqual(n_url, 1)
        return next(iter(urls)) if n_url > 0 else None

    def _message_post(self, record):
        with self.mock_mail_gateway():
            record.message_post(body='test message', subtype_id=self.env.ref('mail.mt_comment').id)
            self.assertEqual(len(self._mails), 1)
            return self._mails[0]['body']

    def _notify_thread_by_email(self, record, partner):
        with self.mock_mail_gateway():
            recipients_data = self._generate_notify_recipients(partner)
            test_message = self.env['mail.message'].browse(self.test_message.ids).copy()
            record._notify_thread_by_email(test_message, recipients_data)
            self.assertEqual(len(self._mails), 1)
            return self._mails[0]['body']

    def _url_tampering(self, url, **kwargs):
        parsed_url = urlparse(url)
        return parsed_url._replace(query=urlencode(dict(parse_qsl(parsed_url.query), **kwargs))).geturl()

    def _test_tampered_unfollow_url(self, record, unfollow_url, partner):
        for param, value in (('token', '0000000000000000000000000000000000000000'),
                             ('model', 'mail.test.gateway'),
                             ('res_id', record.copy().id)):
            with self.subTest(f'Tampered {param}'):
                tampered_unfollow_url = self._url_tampering(unfollow_url, **{param: value})
                response = self.url_open(tampered_unfollow_url)
                self.assertEqual(response.status_code, 403)
                self.assertIn(partner, record.message_partner_ids)

        with self.subTest('Tampered partner id'):
            record._message_subscribe(partner_ids=self.partner_admin.ids)
            tampered_unfollow_url = self._url_tampering(unfollow_url, pid=self.partner_admin.id)
            response = self.url_open(tampered_unfollow_url)
            self.assertEqual(response.status_code, 403)
            self.assertIn(partner, record.message_partner_ids)
            self.assertIn(self.partner_admin, record.message_partner_ids)
            record.message_unsubscribe(partner_ids=self.partner_admin.ids)

    def _test_unfollow_url(self, record, unfollow_url, partner, landing_url_check_mode):
        with self.subTest('Legitimate unfollow'):
            # We test that the URL still work a second time if the user has been re-added
            for _ in range(2):
                try:
                    self.assertIn(partner, record.message_partner_ids)
                    response = self.url_open(unfollow_url)
                    self.assertEqual(response.status_code, 200)
                    self.assertNotIn(partner, record.message_partner_ids.ids)
                    if landing_url_check_mode == 'record':
                        self.assertEqual(urlparse(response.url).path, '/web')
                        self.assertIn(f'model={record._name}', response.url)
                        self.assertIn(f'id={record.id}', response.url)
                    elif landing_url_check_mode == 'front_end_message':
                        self.assertEqual(urlparse(response.url).path, '/mail/unfollow')
                        self.assertIn("You are no longer following the document.", response.text)
                    else:
                        raise NotImplementedError(f'landing_url_check_mode {landing_url_check_mode}')
                finally:
                    record._message_subscribe(partner_ids=partner.ids)

    @users('employee')
    @mute_logger('odoo.addons.mail.controllers.mail', 'odoo.http')
    def test_unfollow_internal_user(self):
        """Internal user must receive an unfollow URL, that works, cannot be tampered and redirects to the correct page.

        Note: When connected, the user must be redirected to the record otherwise a simple front end page.
        """
        test_record = self.test_record_admin
        test_partner = self.partner_employee

        test_record._message_subscribe(partner_ids=test_partner.ids)
        try:
            with self.subTest('Internal user receives unfollow URL'):
                unfollow_url = self._extract_unfollow_url(self._message_post(test_record))
                self.assertTrue(unfollow_url)
            self._test_unfollow_url(test_record, unfollow_url, test_partner, 'front_end_message')
            self._test_tampered_unfollow_url(test_record, unfollow_url, test_partner)

            self.authenticate(self.user_employee.login, self.user_employee.login)
            self._test_unfollow_url(test_record, unfollow_url, test_partner, 'record')

            test_record.message_unsubscribe(partner_ids=test_partner.ids)
            with self.subTest('Internal user simple notification (without unfollow URL)'):
                unfollow_url = self._extract_unfollow_url(self._notify_thread_by_email(test_record, test_partner))
                self.assertFalse(unfollow_url)
        finally:
            test_record.message_unsubscribe(partner_ids=test_partner.ids)

    def test_unfollow_partner_with_no_user(self):
        """External partner must not receive an unfollow URL."""
        test_record = self.test_record_admin
        test_partner = self.partner_without_user

        test_record._message_subscribe(partner_ids=test_partner.ids)
        try:
            with self.subTest('External partner must not receive an unfollow URL'):
                unfollow_url = self._extract_unfollow_url(self._message_post(test_record))
                self.assertFalse(unfollow_url)
        finally:
            test_record.message_unsubscribe(partner_ids=self.partner_without_user.ids)

    @mute_logger('odoo.addons.mail.controllers.mail', 'odoo.http')
    def test_unfollow_partner_with_no_user_on_record_unfollow_enabled(self):
        """External partner must receive an unfollow URL for message related to record with unfollow enabled."""
        test_record = self.test_record_unfollow_admin
        test_partner = self.partner_without_user

        test_record._message_subscribe(partner_ids=test_partner.ids)
        try:
            with self.subTest('External partner receives an unfollow URL'):
                unfollow_url = self._extract_unfollow_url(self._message_post(test_record))
                self.assertTrue(unfollow_url)
            self._test_unfollow_url(test_record, unfollow_url, test_partner, 'front_end_message')
            self._test_tampered_unfollow_url(test_record, unfollow_url, test_partner)

            test_record.message_unsubscribe(partner_ids=test_partner.ids)
            with self.subTest('External partner not following must not receive unfollow URL'):
                unfollow_url = self._extract_unfollow_url(self._notify_thread_by_email(test_record, test_partner))
                self.assertFalse(unfollow_url)
        finally:
            test_record.message_unsubscribe(partner_ids=test_partner.ids)
