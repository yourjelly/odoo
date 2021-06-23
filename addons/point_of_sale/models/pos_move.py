from odoo import fields, models, _


class PosMove(models.Model):
    _name = "pos.move"
    _description = "Point of Sale Moves"

    name = fields.Char(string="Label", readonly=True)
    currency_id = fields.Many2one("res.currency", string="Currency")
    currency_rate = fields.Float(string="Conversion Rate", help="Conversion rate from company currency to order currency.")
    partner_id = fields.Many2one("res.partner", string="Customer")
    session_id = fields.Many2one("pos.session", string="Session")
    company_id = fields.Many2one("res.company", string="Company")
    payment_ids = fields.One2many("pos.payment", "pos_move_id", string="Payments")
