# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import Command
from odoo.tests.common import users, tagged, TransactionCase

@tagged('post_install', '-at_install')
class TestDiscussFullMessage(TransactionCase):
    def setUp(self):
        super().setUp()
        self.users = self.env['res.users'].create([
            {
                'email': 'e.e@example.com',
                'groups_id': [Command.link(self.env.ref('base.group_user').id)],
                'login': 'emp',
                'name': 'Ernest Employee',
                'notification_type': 'inbox',
                'odoobot_state': 'disabled',
                'signature': '--\nErnest',
            },
            {'name': 'test1', 'login': 'test1', 'email': 'test1@example.com'},
        ])

    @users('emp')
    def test_message_format(self):
        im_livechat_channel = self.env['im_livechat.channel'].sudo().create({'name': 'support', 'user_ids': [Command.link(self.users[0].id)]})
        self.users[0].im_status = 'online'  # make available for livechat (ignore leave)
        channel_livechat_1 = self.env['mail.channel'].browse(im_livechat_channel._open_livechat_mail_channel(anonymous_name='anon 1', previous_operator_id=self.users[0].partner_id.id, user_id=self.users[1].id, country_id=self.env.ref('base.in').id)['id'])
        record_rating = self.env['rating.rating'].create({
            'res_model_id': self.env['ir.model']._get('mail.channel').id,
            'res_id': channel_livechat_1.id,
            'parent_res_model_id': self.env['ir.model']._get('im_livechat.channel').id,
            'parent_res_id': im_livechat_channel.id,
            'rated_partner_id': self.users[0].partner_id.id,
            'partner_id': self.users[1].partner_id.id,
            'rating': 5,
            'consumed': True,
        })
        message = channel_livechat_1.message_post(
            author_id=record_rating.partner_id.id,
            body="<img src='%s' alt=':%s/5' style='width:18px;height:18px;float:left;margin-right: 5px;'/>%s"
            % (record_rating.rating_image_url, record_rating.rating, record_rating.feedback),
            rating_id=record_rating.id,
        )
        self.assertEqual(message.message_format(), [{
            'id': message.id,
            'body': message.body,
            'date': message.date,
            'author_id': (self.users[1].partner_id.id, "test1"),
            'message_type': 'notification',
            'subtype_id': (2, 'Note'),
            'subject': False,
            'model': 'mail.channel',
            'res_id': channel_livechat_1.id,
            'record_name': "test1 Ernest Employee",
            'starred_partner_ids': [],
            'notifications': [],
            'attachment_ids': [],
            'tracking_value_ids': [],
            'messageReactionGroups': [('insert-and-replace', [])],
            'needaction_partner_ids': [],
            'history_partner_ids': [],
            'is_note': True,
            'is_discussion': False,
            'subtype_description': False,
            'is_notification': False,
            'recipients': [],
            'module_icon': '/mail/static/description/icon.png',
            'rating': [('insert-and-replace', {
                'id': record_rating.id,
                'ratingImageUrl': record_rating.rating_image_url,
                'ratingText': record_rating.rating_text,
            })],
            'sms_ids': []
        }])
