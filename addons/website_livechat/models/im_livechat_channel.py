# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, _


class ImLivechatChannel(models.Model):
    _inherit = 'im_livechat.channel'

    def _get_livechat_mail_channel_vals(self, anonymous_name, operator=None, chatbot=None, user_id=None, country_id=None):
        mail_channel_vals = super(ImLivechatChannel, self)._get_livechat_mail_channel_vals(anonymous_name, operator, chatbot, user_id=user_id, country_id=country_id)
        visitor_sudo = self.env['website.visitor']._get_visitor_from_request()
        if visitor_sudo:
            mail_channel_vals['livechat_visitor_id'] = visitor_sudo.id
        return mail_channel_vals

    def _open_livechat_mail_channel(self, anonymous_name, previous_operator_id=None, chatbot_script=None, uuid=None, user_id=None, country_id=None):
        channel_info = super()._open_livechat_mail_channel(anonymous_name, previous_operator_id, chatbot_script, uuid, user_id, country_id)
        visitor_sudo = self.env['website.visitor']._get_visitor_from_request()
        if visitor_sudo:
            # As chat requested by the visitor, delete the chat requested by an operator if any to avoid conflicts between two flows
            chat_request_channel = self.env['mail.channel'].sudo().search([('livechat_visitor_id', '=', visitor_sudo.id), ('livechat_active', '=', True)])
            for mail_channel in chat_request_channel:
                operator_name = channel_info['operator_pid'][1],
                mail_channel._close_livechat_session(cancel=True, operator=operator_name)
        return channel_info
