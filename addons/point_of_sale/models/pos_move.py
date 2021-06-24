from odoo import api, fields, models, _


class PosMove(models.Model):
    _name = "pos.move"
    _description = "Point of Sale Moves"

    name = fields.Char(string="Label", readonly=True)
    date = fields.Datetime(string="Date", readonly=True, index=True, default=fields.Datetime.now)
    currency_id = fields.Many2one("res.currency", string="Currency")
    currency_rate = fields.Float(string="Conversion Rate", compute="_compute_currency_rate", help="Conversion rate from company currency to order currency.")
    partner_id = fields.Many2one("res.partner", string="Customer")
    session_id = fields.Many2one("pos.session", string="Session")
    company_id = fields.Many2one("res.company", string="Company")
    payment_ids = fields.One2many("pos.payment", "pos_move_id", string="Payments")

    @api.depends("date", "company_id", "currency_id", "company_id.currency_id")
    def _compute_currency_rate(self):
        for move in self:
            move.currency_rate = self.env["res.currency"]._get_conversion_rate(move.company_id.currency_id, move.currency_id, move.company_id, move.date)
