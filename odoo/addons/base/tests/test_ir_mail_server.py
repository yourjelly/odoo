# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.base.models.ir_mail_server import extract_rfc2822_addresses
from odoo.tests.common import TransactionCase
from odoo.tools import mute_logger


class TestIrMailServer(TransactionCase):
    def setUp(self):
        super(TestIrMailServer, self).setUp()
        self.env['ir.config_parameter'].sudo().set_param('mail.catchall.domain', 'odoo.com')
        self.env['ir.config_parameter'].sudo().set_param('mail.default.from', 'notifications')
        ir_mail_server_values = {
            'smtp_host': 'smtp_host',
            'smtp_encryption': 'none',
        }
        self.env['ir.mail_server'].create([
            {
                'name': 'Server Odoo',
                'from_filter': 'odoo.com',
                ** ir_mail_server_values,
            }, {
                'name': 'Server STD account',
                'from_filter': 'std@odoo.com',
                ** ir_mail_server_values,
            },  {
                'name': 'Server Notifications',
                'from_filter': 'notifications@odoo.com',
                ** ir_mail_server_values,
            },  {
                'name': 'Server No From Filter',
                'from_filter': False,
                ** ir_mail_server_values,
            },
        ])

    def test_extract_rfc2822_addresses(self):
        result = extract_rfc2822_addresses('"Admin" <admin@gmail.com>')
        self.assertEqual(result, ['admin@gmail.com'])
        result = extract_rfc2822_addresses('"Admin" <admin@gmail.com>, Demo <demo@odoo.com>')
        self.assertEqual(result, ['admin@gmail.com', 'demo@odoo.com'])

    def test_mail_server_priorities(self):
        """Test if we choose the right mail server to send an email.

        Priorities are
        1. Forced mail server (e.g.: in mass mailing)
            - If the "from_filter" of the mail server match the notification email
              use the notifications email in the "From header"
            - Otherwise spoof the "From" (because we force the mail server but we don't
              know which email use to send it)
        2. A mail server for which the "from_filter" match the "From" header
        3. A mail server for which the "from_filter" match the domain of the "From" header
        4. The mail server used for notifications
        5. A mail server without "from_filter" (and so spoof the "From" header because we
           do not know for which email address it can be used)
        """
        # sanity checks
        self.assertTrue(self.env['ir.mail_server']._get_default_from_address(), 'Notifications email must be set for testing')
        self.assertTrue(self.env['ir.mail_server']._get_default_bounce_address(), 'Bounce email must be set for testing')

        mail_server, mail_from = self.env['ir.mail_server']._find_mail_server(mail_from='std@odoo.com')
        self.assertEqual(mail_server.from_filter, 'std@odoo.com')
        self.assertEqual(mail_from, 'std@odoo.com')

        # Should not be case sensitive
        mail_server, mail_from = self.env['ir.mail_server']._find_mail_server(mail_from='sTd@oDoo.cOm')
        self.assertEqual(mail_server.from_filter, 'std@odoo.com', 'Mail from is case insensitive')
        self.assertEqual(mail_from, 'sTd@oDoo.cOm', 'Should not change the mail from')

        mail_server, mail_from = self.env['ir.mail_server']._find_mail_server(mail_from='XSS@odoo.com')
        self.assertEqual(mail_server.from_filter, 'odoo.com')
        self.assertEqual(mail_from, 'XSS@odoo.com')

        mail_server, mail_from = self.env['ir.mail_server']._find_mail_server(mail_from='XSS@gmail.com')
        self.assertEqual(mail_server.from_filter, 'notifications@odoo.com', 'Should encapsulate the mail because it is sent from gmail')
        self.assertEqual(mail_from, 'notifications@odoo.com')

        # remove the notifications email to simulate a mis-configured Odoo database
        # so we do not have the choice, we have to spoof the FROM
        # (otherwise we can not send the email)
        self.env['ir.config_parameter'].sudo().set_param('mail.catchall.domain', False)
        with mute_logger('odoo.addons.base.models.ir_mail_server'):
            mail_server, mail_from = self.env['ir.mail_server']._find_mail_server(mail_from='XSS@gmail.com')
            self.assertEqual(mail_server.from_filter, False, 'No notifications email set, must be forced to spoof the FROM')
            self.assertEqual(mail_from, 'XSS@gmail.com')

    def test_mail_server_send_email(self):
        ###################
        return



        default_bounce_adress = self.env['ir.mail_server']._get_default_bounce_address()

        message = self._build_email(mail_from='std@odoo.com')
        smtp_from, _, message, mail_server = self.env['ir.mail_server']._prepare_message(message)
        self.assertEqual(smtp_from, 'std@odoo.com')
        self.assertIn('std@odoo.com', message['From'])
        self.assertEqual(mail_server.from_filter, 'std@odoo.com')

        message = self._build_email(mail_from='std@gmail.com')
        smtp_from, _, message, mail_server = self.env['ir.mail_server']._prepare_message(message)
        self.assertEqual(smtp_from, 'notifications@odoo.com')
        self.assertIn('<notifications@odoo.com>', message['From'])
        self.assertEqual(mail_server.from_filter, 'notifications@odoo.com')

        message = self._build_email(mail_from='xss@odoo.com')
        smtp_from, _, message, mail_server = self.env['ir.mail_server']._prepare_message(message)
        self.assertEqual(smtp_from, default_bounce_adress)
        self.assertIn('xss@odoo.com', message['From'])
        self.assertEqual(mail_server.from_filter, 'odoo.com')

        # remove the notification server
        # so <notifications@odoo.com> will use the <odoo.com> mail server
        self.env['ir.mail_server'].search([('from_filter', '=', 'notifications@odoo.com')]).unlink()

        message = self._build_email(mail_from='std@gmail.com')
        smtp_from, _, message, mail_server = self.env['ir.mail_server']._prepare_message(message)
        self.assertEqual(smtp_from, default_bounce_adress)
        self.assertIn('<notifications@odoo.com>', message['From'])
        self.assertEqual(mail_server.from_filter, 'odoo.com')

    def _build_email(self, mail_from, return_path=None):
        return self.env['ir.mail_server'].build_email(
            email_from=mail_from,
            email_to='destination@example.com',
            subject='subject', body='body',
            headers={'Return-Path': return_path} if return_path else None
        )
