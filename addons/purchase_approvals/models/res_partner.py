# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import api, fields, models, _
from odoo.exceptions import UserError

class ResPartner(models.Model):
    _name = "res.partner"
    _inherit = "res.partner"

    check_for_users = fields.Boolean()
    purchase_order_approval_responsible_ids = fields.Many2many('res.users', 'partner_purchase_order_approval_rel',
        'partner_id', 'user_id', string='Purchase Order Approval Responsible Users')
    purchase_order_creation_responsible_ids = fields.Many2many('res.users', 'partner_purchase_order_creation_rel',
        'partner_id', 'user_id', string='Purchase Order Creation Responsible Users')
