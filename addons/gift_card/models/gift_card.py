# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import _, api, fields, models
from odoo.exceptions import ValidationError
from uuid import uuid4


class GiftCard(models.Model):
    # inherited Fields
    _name = "gift.card"
    _description = "Gift Card"
    _order = 'id desc'
    _check_company_auto = True

    # helpers
    @api.model
    def _generate_code(self):
        return str(uuid4())[4:-8]

    # Relational fields
    company_id = fields.Many2one(
        'res.company', string='Company',
        default=lambda self: self.env.company)

    currency_id = fields.Many2one('res.currency',
                                  string='Currency',
                                  readonly=True,
                                  related='company_id.currency_id')
    buy_line_id = fields.Many2one("sale.order.line",
                                  copy=False,
                                  help="Sale Order line where this gift card has been bought.",
                                  readonly=True)
    redeem_line_ids = fields.One2many('sale.order.line', 'payed_with_gift_card_id',
                                      copy=False,
                                      string="Redeems")

    # simple fields
    name = fields.Char(compute='_compute_name')
    code = fields.Char(default=_generate_code, required=True, readonly=True, copy=False)
    initial_amount = fields.Monetary(required=True, currency_field='currency_id')
    balance = fields.Monetary(currency_field='currency_id', compute="_compute_balance")
    actual_balance = fields.Monetary(currency_field='currency_id', compute="_compute_balance")
    expired_date = fields.Date(copy=False,
                               required=True,
                               default=lambda self: fields.Date.add(fields.Date.context_today(self), years=1))
    state = fields.Selection(
        selection=[('valid', 'Valid'), ('expired', 'Expired')],
        default='valid',
        copy=False
    )

    _sql_constraints = [
        ('unique_gift_card_code', 'UNIQUE(code)',
         'The gift card code must be unique.'),
        ('check_amount', 'CHECK(initial_amount >= 0)',
         'The initial amount must be positive.')
    ]

    # Computed func
    @api.depends("balance")
    def _compute_name(self):
        for record in self:
            record.name = _("Gift #%s (%s)") % (self.id, self.balance)

    @api.depends("initial_amount", "redeem_line_ids")
    def _compute_balance(self):
        for record in self:
            record.balance = record.initial_amount + \
                             sum([line.currency_id._convert(line.price_unit, record.currency_id, record.env.company,
                                                            line.create_date) for line in record.redeem_line_ids
                                 .filtered(lambda l: l.state == 'sale')])
            record.actual_balance = record.initial_amount + \
                                    sum([line.currency_id._convert(line.price_unit, record.currency_id,
                                                                   record.env.company,
                                                                   line.create_date) for line in
                                         record.redeem_line_ids])

    @api.constrains("expired_date")
    def _constrains_expired_date(self):
        for record in self:
            if record.expired_date < record.create_date.date():
                raise ValidationError(_("The expiration date must be greater than the purchase."))

    def cron_expire_gift_card(self):
        self.env['gift.card'].search(['&', ('state', '=', 'valid'), ('expired_date', '<', 'now()')]) \
            .write({'state': 'expired'})

    # Logic
    def is_valid(self):
        return self.state == 'valid' and self.balance > 0

    def release_unconfirmed_line_orders(self):
        self.redeem_line_ids.filtered(lambda w_t: w_t.state != "sale").unlink()

    def how_much_can_be_retained(self, amount, currency_id):
        retained = min(amount,
                       self.currency_id._convert(self.balance, currency_id, self.env.company, fields.Date.today()))
        return retained
