# -*- coding: utf-8 -*-
from odoo import api, fields, models, _


class MailBot(models.AbstractModel):
    _inherit = 'mail.bot'

    def _apply_logic(self, record, values, command=None):
        """ Apply bot logic to generate an answer (or not) for the user
        The logic will only be applied if odoobot is in a chat with a user or
        if someone pinged odoobot.

         :param record: the mail_thread (or mail_channel) where the user
            message was posted/odoobot will answer.
         :param values: msg_values of the message_post or other values needed by logic
         :param command: the name of the called command if the logic is not triggered by a message_post
        """
        accountbot_id = self.env['ir.model.data'].xmlid_to_res_id("account_ai.partner_accountbot")
        if record.name != 'AccountBot':
            return super(MailBot, self)._apply_logic(record, values, command)

        if len(record) != 1 or values.get("author_id") == accountbot_id:
            return
        if self._is_bot_in_private_channel(record):
            body = values.get("body", "").replace(u'\xa0', u' ').strip().lower().strip(".?!")
            answer = 'I am not yet programmed to answer to you 😱 <br>I am learning, I promise.'
            if answer:
                message_type = values.get('message_type', 'comment')
                subtype_id = values.get('subtype_id', self.env['ir.model.data'].xmlid_to_res_id('mail.mt_comment'))
                record.with_context(mail_create_nosubscribe=True).sudo().message_post(body=answer, author_id=accountbot_id, message_type=message_type, subtype_id=subtype_id)

    def _is_bot_in_private_channel(self, record):
        accountbot_id = self.env['ir.model.data'].xmlid_to_res_id("account_ai.partner_accountbot")
        if record._name == 'mail.channel' and record.channel_type == 'chat':
            return accountbot_id in record.with_context(active_test=False).channel_partner_ids.ids
        return False
