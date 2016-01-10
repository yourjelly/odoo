# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from openerp import api, fields, models, _
from openerp.exceptions import UserError

class Users(models.Model):
    _inherit = 'res.users'

    target_closed = fields.Float('Target Tickets to Close')
    target_rating = fields.Float('Target Customer Rating')
    target_success = fields.Float('Target Success Rate')

