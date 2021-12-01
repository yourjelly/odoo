# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class ChatbotScriptQuestion(models.Model):
    _name = 'im_livechat.chatbot.script_question'
    _description = 'Chatbot Script Question'

    name = fields.Char('Question')
    sequence = fields.Integer('Sequence', default=10)
    chatbot_id = fields.Many2one('im_livechat.chatbot.bot', 'Chatbot', required=True, ondelete="cascade")
    answer_ids = fields.One2many('im_livechat.chatbot.script_question_answer', 'question_id',
        string="Answers")
    triggering_question_answer_ids = fields.Many2many(
        'im_livechat.chatbot.script_question_answer',
        'chatbot_bot_chatbot_script_question_answer_rel',
        'chatbot_script_question_id', 'chatbot_script_question_answer_id',
        string="Only if", help="This question will only show up if all the answers are picked.")
