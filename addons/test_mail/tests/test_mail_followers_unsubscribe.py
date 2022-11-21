# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.test_mail.tests.test_message_post import TestMessagePostCommon
from odoo.tests import tagged
from odoo.tests import users


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
