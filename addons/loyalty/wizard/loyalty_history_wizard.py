from odoo import _, fields, models
from odoo.exceptions import ValidationError


class SaleLoyaltyHistoryWizard(models.TransientModel):
    _name = 'sale.loyalty.history.wizard'
    _description = 'History Coupons'

    card_id = fields.Many2one(
        comodel_name='loyalty.card',
        required=True,
        default=lambda self: self.env.context.get('active_id')
    )
    old_balance = fields.Float(
        related='card_id.points',
        string="Old balance",
        depends=['card_id']
    )
    new_balance = fields.Float(default=200.0, string="New balance")
    description = fields.Char(default="Gift for Customer", string="Descriptions")

    def history_coupons(self):
        if self.old_balance == self.new_balance:
            raise ValidationError(_("Invalid balanced."))
        self.env['loyalty.history'].create({
                'card_id': self.card_id.id,
                'description': self.description,
                'used': self.old_balance - self.new_balance
                    if self.old_balance > self.new_balance else 0,
                'issued': self.new_balance - self.old_balance
                    if self.old_balance < self.new_balance else 0,
                'new_balance': self.new_balance,
            })
        self.card_id.points = self.new_balance
        return True
