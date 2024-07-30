# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models, fields


class LoyaltyHistory(models.Model):
    _name = 'loyalty.history'
    _description = 'History for Loyalty cards and Ewallets'
    _order = "date desc"

    description = fields.Text(string='Description', required=True, default="refund of ...")
    card_id = fields.Many2one(comodel_name='loyalty.card', required=True, ondelete="cascade")
    date = fields.Datetime(string='Date', compute="_compute_date", store=True)
    issued = fields.Float(string='Issued')
    new_balance = fields.Float(string='New Balance')
    order_id = fields.Reference(string='Order', selection=[], readonly=True, store=True, ondelete="cascade")
    used = fields.Float(string='Used')

    @api.depends('description')
    def _compute_date(self):
        self.date = fields.Datetime.now()
