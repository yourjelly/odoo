from odoo import _, api, fields, models
from odoo.exceptions import ValidationError


class LoyaltyHistoryWizard(models.TransientModel):
    _name = 'loyalty.card.points.change.wizard'
    _description = "History Coupons"

    card_id = fields.Many2one(
        comodel_name='loyalty.card',
        required=True,
        readonly=True,
        default=lambda self: self.env.context.get('default_card_id', False),
    )
    old_balance = fields.Float(
        string="Old balance",
        readonly=True,
        default=lambda self: self.env.context.get('old_balance', False),
    )
    new_balance = fields.Float(string="New balance", default=200.0)
    description = fields.Char(string="Descriptions")

    @api.depends('card_id')
    def _compute_old_balance(self):
        for record in self:
            record.old_balance = record.card_id.points

    def change_card_balance(self):
        if self.old_balance == self.new_balance:
            raise ValidationError(_("Invalid balance"))
        self.env['loyalty.history'].create({
                'card_id': self.card_id.id,
                'description': self.description if self.description else "Gift for customer",
                'used': self.old_balance - self.new_balance
                    if self.old_balance > self.new_balance else 0,
                'issued': self.new_balance - self.old_balance
                    if self.old_balance < self.new_balance else 0,
                'new_balance': self.new_balance,
            })
        self.card_id.points = self.new_balance
        return True
