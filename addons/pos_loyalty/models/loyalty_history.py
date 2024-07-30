# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields


class LoyaltyHistory(models.Model):
    _inherit = "loyalty.history"

    order_id = fields.Reference(selection_add=[('pos.order', 'POS Order')])
