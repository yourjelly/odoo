# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, api


class ResUsers(models.Model):
    _inherit = 'res.users'

    sale_team_id = fields.Many2one(
        'crm.team', 'Sales Channel',
        help='Sales Channel the user is member of. Used to compute the members of a sales channel through the inverse one2many')

    @api.model
    def create(self, vals):
        print "valss", vals
        return super(ResUsers, self).create(vals)

    @api.multi
    def write(self, vals):
        print "write valss", vals
        return super(ResUsers, self).write(vals)

    @api.multi
    def unlink(self):
        print "sel>>>>>f", self
        return super(ResUsers, self).unlink()
