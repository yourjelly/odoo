# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models
from odoo.osv import expression


class ChatbotScriptQuestionAnswer(models.Model):
    _name = 'im_livechat.chatbot.script_question_answer'
    _description = 'Chatbot Script Question Answer'

    name = fields.Char('Answer')
    sequence = fields.Integer('Sequence', default=10)
    question_id = fields.Many2one('im_livechat.chatbot.script_question', 'Question', required=True, ondelete="cascade")
    chatbot_id = fields.Many2one(related='question_id.chatbot_id', store=True)

    def name_get(self):
        return [(
            answer.id, "%s: %s" % (answer.question_id.name, answer.name)
        ) for answer in self]

    @api.model
    def _name_search(self, name, args=None, operator='ilike', limit=100, name_get_uid=None):
        force_domain_chatbot_id = self.env.context.get('force_domain_chatbot_id')

        if name and operator == 'ilike':
            if not args:
                args = []

            # search on both name OR question's name (combined with passed args)
            name_domain = expression.AND([[('name', operator, name)], args])
            question_domain = expression.AND([[('question_id', operator, name)], args])
            domain = expression.OR([name_domain, question_domain])

            if force_domain_chatbot_id:
                domain = expression.AND([domain, [('chatbot_id', '=', force_domain_chatbot_id)]])

            return self._search(domain, limit=limit, access_rights_uid=name_get_uid)
        else:
            domain = args or []
            if force_domain_chatbot_id:
                domain = expression.AND([domain, [('chatbot_id', '=', force_domain_chatbot_id)]])

            return self._search(domain, limit=limit, access_rights_uid=name_get_uid)
