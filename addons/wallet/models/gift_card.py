# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from uuid import uuid4

from odoo import _, api, fields, models
from odoo.exceptions import ValidationError


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
    sale_order_id = fields.Many2one("sale.order",
                                    help="Sale Order where this gift card has been bought",
                                    readonly=True)
    wallet_transaction_id = fields.Many2one('wallet.transaction',
                                            copy=False,
                                            help="Wallet Transaction that add this gift card to a wallet")
    partner_id = fields.Many2one('res.partner', help="If filled, only this customer can use it")

    # simple fields
    name = fields.Char(compute='_compute_name')
    code = fields.Char(default=_generate_code, required=True, readonly=True, copy=False)
    amount = fields.Monetary(required=True, currency_field='currency_id')
    expired_date = fields.Date(copy=False,
                               required=True,
                               default=lambda self: fields.Date.add(fields.Date.context_today(self), years=1))
    state = fields.Selection(
        selection=[('new', 'New'), ('used', 'Used'), ('expired', 'Expired')],
        default='new',
        copy=False
    )

    _sql_constraints = [
        ('unique_gift_card_code', 'UNIQUE(code)',
         'The gift card code must be unique.'),
        ('check_amount', 'CHECK(amount >= 0)',
         'The initial amount must be positive.')
    ]

    # Computed func
    @api.depends("amount")
    def _compute_name(self):
        for record in self:
            record.name = _("Gift #%s (%s)") % (self.id, self.amount)

    @api.constrains("expired_date")
    def _expired_date_constrains(self):
        for record in self:
            if record.expired_date < record.create_date.date():
                raise ValidationError(_("The expiration date must be greater than the purchase date"))

    @api.constrains("partner_id")
    def _partner_id_constrains(self):
        for record in self:
            if record.state != "new":
                raise ValidationError(_("The gift card partner cannot be changed after being added."))

    @api.constrains("wallet_transaction_id")
    def _wallet_transaction_id_constrains(self):
        for record in self.filtered(lambda gc: gc.wallet_transaction_id):
            record._set_related_field(record.wallet_transaction_id)
            record.state = "used"

    def _set_related_field(self, wallet_transaction_id):
        self.partner_id = wallet_transaction_id.wallet_id.partner_id

    def cron_expire_gift_card(self):
        self.env['gift.card'].search(['&', ('state', '=', 'new'), ('expired_date', '<', 'now()')])\
            .write({'state': 'expired'})

    # Logic
    def is_new(self, partner_id):
        return self.state == 'new' and self.partner_id.id in [partner_id.id, False]
