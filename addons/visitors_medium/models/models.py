# -*- coding: utf-8 -*-

from odoo import models, fields, api
from odoo.exceptions import ValidationError


class visitors_medium_graph(models.Model):
    _name = 'visitors_medium.graph'
    _description = 'Visitors Medium Graph'
    _rec_name = 'user_id'

    user_id = fields.Many2one('res.users', string='User',)
    date = fields.Date()
    source_id = fields.Many2one('utm.medium', string='Source')
    target_id = fields.Many2one('utm.medium', string='Target')
    count = fields.Integer()

    @api.constrains('source_id', 'target_id')
    def _check_data(self):
        if self.source_id.name == self.target_id.name:
            raise ValidationError("Source and Target must be different")
