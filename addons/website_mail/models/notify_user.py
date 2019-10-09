# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import api,fields,models

class NotifyUser(models.Model):

    _name = 'notify.user'

    current_user = fields.Many2one('res.users','Current User', default=lambda self: self.env.user.id)
    name = fields.Char(string="name", default="xyz")

    @api.model
    def create(self,vals):
        op=self._get_current_user()

    @api.model
    def get_current_user(self):
        users = self.env['res.users'].search([])
        for current_user in users:
            get_current_login = self.env.user
            if current_user == get_current_login:
                self.processing_staff = current_login
