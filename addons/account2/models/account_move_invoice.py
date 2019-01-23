from odoo import api, fields, models, tools, SUPERUSER_ID, _


class AccountMove(models.Model):
    _name = 'account.move'
    _description = 'Account Moves'
    _table = 'account_move'

    name = fields.Char("Name")
    extra_name = fields.Char("Juij")
    second_stuff = fields.Char("Second")


class AccountInvoice(models.Model):
    _name = 'account.invoice'
    _description = 'Invoice'
    _table = 'account_invoice'
    _inherit = 'account.move'
    _sequence = 'account_move_id_seq'

    payment_term = fields.Char("Payment Term")

    @api.onchange('name')
    def _onchange(self):
        if self.name == 'j':
            self.payment_term = 'jjj'
