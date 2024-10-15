# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models
from odoo.addons import event, point_of_sale


class EventQuestion(event.EventQuestion, point_of_sale.PosLoadMixin):

    @api.model
    def _load_pos_data_fields(self, config_id):
        return ['title', 'question_type', 'event_type_id', 'event_id', 'sequence', 'once_per_order', 'is_mandatory_answer', 'answer_ids']

    @api.model
    def _load_pos_data_domain(self, data):
        return [('event_id', 'in', [event['id'] for event in data['event.event']['data']])]
