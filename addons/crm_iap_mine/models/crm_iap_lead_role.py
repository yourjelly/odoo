# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class PeopleRole(models.Model):
    """ CRM Reveal People Roles for People """
    _name = 'crm.iap.lead.role'
    _description = 'People Role'

    name = fields.Char(string='Role Name', required=True, translate=True)
    reveal_id = fields.Char(required=True)
    color = fields.Integer(string='Color Index')

    @api.depends('name')
    def name_get(self):
        return [(role.id, role.name.replace('_', ' ').title()) for role in self]
