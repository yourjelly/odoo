# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class Tour(models.Model):

    _name = "web_tour.tour"
    _description = "Tours"

    name = fields.Char(string="Tour name", required=True)
    user_ids = fields.Many2many('res.users', string='Consumed by')
    is_consumed = fields.Boolean(string='Is consumed', compute='_is_consumed')

    _sql_constraints = [
        ('name_uniq', 'unique (name)', "Tour name already exists !"),
    ]

    @api.one
    @api.depends('user_ids')
    def _is_consumed(self):
        self.is_consumed = self.env.user in self.user_ids

    @api.multi
    def consume(self):
        self.write({'user_ids': [(4, self.env.uid)]})
