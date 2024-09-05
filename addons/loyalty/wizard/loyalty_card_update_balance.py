from odoo import _, fields, models
from odoo.exceptions import ValidationError


class LoyaltyHistoryWizard(models.TransientModel):
    _name = 'loyalty.card.update.balance'
    _description = "Update Loyalty Card Points"

    card_id = fields.Many2one(
        comodel_name='loyalty.card',
        required=True,
        readonly=True,
    )
    old_balance = fields.Float(readonly=True)
    new_balance = fields.Float()
    description = fields.Char()

    def action_update_card_point(self):
        if self.old_balance == self.new_balance or self.new_balance < 0:
            raise ValidationError(_("New Balance should be positive and different then old balance."))
        differance = self.new_balance - self.old_balance
        used = 0
        issued = 0
        if differance > 0:
            issued = differance
        else:
            used = differance

        self.env['loyalty.history'].create({
                'card_id': self.card_id.id,
                'description': self.description or "Gift for customer",
                'used': used,
                'issued': issued,
                'new_balance': self.new_balance,
            })
        self.card_id.points = self.new_balance
        return True
