# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields


class Step(models.Model):
    _name = 'web_editor.collaboration.step'
    _description = 'Web Editor History Step'

    mutations = fields.Char()
    collab_document_id = fields.Char()
    step_id = fields.Char()
    cursor = fields.Char()
    previous_step_id = fields.Char()
    index = fields.Integer()
    user_id = fields.Many2one('res.users')

    _sql_constraints = [(
        'web_editor_unique_collaboration_step_id',
        'UNIQUE (step_id)',
        'Can not have two step with the same step id'
    ), (
        'web_editor_unique_previous_step_id_per_document_per_user',
        'UNIQUE (previous_step_id, collab_document_id, user_id)',
        'Can not have two step with the same previous step for a given user and document'
    ), (
        'web_editor_unique_index_per_document',
        'UNIQUE (index, collab_document_id)',
        'Can not have two step with the same index for a given document'
    )]
