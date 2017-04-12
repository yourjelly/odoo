# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models

class MailActivity(models.Model):

    _inherit = 'mail.activity'

    @api.multi
    def createMeetingActivity(self):

    @api.model
    def create(self, values):
        activity = super(MailActivity, self).create(values)
        if self.activity_type_id == 'Meeting':
            print '\n\nself.activity_type_id', self.activity_type_id
