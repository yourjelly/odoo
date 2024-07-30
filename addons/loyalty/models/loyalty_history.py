# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields


class LoyaltyHistory(models.Model):
    _name = 'loyalty.history'
    _description = "History for Loyalty cards and Ewallets"
    _order = 'create_date desc'

    description = fields.Text(required=True)
    card_id = fields.Many2one(comodel_name='loyalty.card', required=True, ondelete='cascade')
    # date = fields.Datetime(default=fields.Datetime.now(), store=True)
    issued = fields.Float()
    new_balance = fields.Float()
    order_id = fields.Reference(selection=[], readonly=True, store=True, ondelete='cascade')
    used = fields.Float()
