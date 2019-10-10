# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import api,fields,models

class NotifyUser(models.Model):

    _name = 'notify.user'
    _inherit = 'mail.thread'

    current_user = fields.Many2one('res.users',string='Current User', default=lambda self: self.env.uid)
    name = fields.Char('name')

    @api.constrains('name')
    def _check_notify(self):
        self.env['mail.message'].create({'message_type':'notification',
                                'subtype': self.env.ref('mail.mt_comment').id,
                                'body':'Demo message','subject':'Message subject',
                                'needaction_partner_ids':[(2)],})

        self.message_post(subject = 'demo message',body = 'Demo message', partner_ids = [(2)])
