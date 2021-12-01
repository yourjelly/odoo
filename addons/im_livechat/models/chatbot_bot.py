# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class ChatbotBot(models.Model):
    _name = 'im_livechat.chatbot.bot'
    _description = 'Chatbot'

    name = fields.Char('Name')
    question_ids = fields.One2many('im_livechat.chatbot.script_question', 'chatbot_id', 'Script Questions')
