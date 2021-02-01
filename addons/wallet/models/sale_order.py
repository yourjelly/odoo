# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, SUPERUSER_ID
from odoo.tools import float_compare


class SaleOrder(models.Model):
    _inherit = "sale.order"

    # Relational fields
    order_line_wallet_id = fields.Many2one('sale.order.line')
    generated_gift_card_ids = fields.One2many('gift.card', "sale_order_id",
                                              string="Bought Gift Card",
                                              copy=False)

    generated_gift_card_count = fields.Integer(compute="_compute_generated_gift_card_count")

    wallet_balance = fields.Monetary(compute='_compute_wallet_balances', string="Balance")
    wallet_actual_balance = fields.Monetary(compute='_compute_wallet_balances', string="Actual Balance")

    # Compute Func
    @api.depends("partner_id")
    def _compute_wallet_balances(self):
        for record in self:
            wallet = record.partner_id.get_wallet()
            record.wallet_balance = wallet.currency_id._convert(
                wallet.balance, record.currency_id,
                self.env.company, fields.Date.today()
            )
            record.wallet_actual_balance = wallet.currency_id._convert(
                wallet.actual_balance, record.currency_id,
                self.env.company, fields.Date.today()
            ) - record.order_line_wallet_id.price_unit

    @api.constrains('state')
    def _constrains_state(self):
        for record in self.filtered(lambda so: so.state == 'cancel' and so.order_line_wallet_id):
            record.order_line_wallet_id.unlink()
        for record in self.filtered(lambda so: so.state == 'sale' and len(so.generated_gift_card_ids) == 0):
            for gift_card_oder_line in record.order_line.filtered(lambda ol: ol.product_id.is_gift_card):
                record._create_gift_cards(gift_card_oder_line)
            record._send_gift_card_mail()

    @api.depends("generated_gift_card_ids")
    def _compute_generated_gift_card_count(self):
        for record in self:
            record.generated_gift_card_count = len(record.generated_gift_card_ids)

    # Logic
    @api.constrains('amount_total')
    def update_wallet_transaction(self):
        for record in self:
            record.add_update_wallet_transaction()

    def add_update_wallet_transaction(self, force_create=False):
        can_be_retained = self.partner_id.get_wallet().how_much_can_be_retained(self.get_total_amount(),
                                                                                self.currency_id)
        if can_be_retained <= 0:
            self.order_line_wallet_id.unlink()
            return
        if self.order_line_wallet_id:
            if can_be_retained != - self.order_line_wallet_id.price_unit:
                self.order_line_wallet_id.update({
                    'price_unit': - can_be_retained,
                    'product_uom_qty': 1
                })
            return False
        if force_create:
            wallet_product_id = self.env['ir.model.data'].xmlid_to_object('wallet.pay_with_wallet_product')
            self.order_line_wallet_id = self.env["sale.order.line"].create({
                'product_id': wallet_product_id.id,
                'price_unit': - can_be_retained,
                'product_uom_qty': 1,
                'product_uom': wallet_product_id.uom_id.id,
                'is_wallet_payment': True,
                'order_id': self.id
            })
            return True

    def get_total_amount(self):
        return sum(self.order_line.filtered(lambda ol: not ol.is_wallet_payment).mapped('price_total'))

    def _create_gift_cards(self, gift_card_order_line):
        return [self.env['gift.card'].create(self._build_gift_card(gift_card_order_line)) for _ in
                range(int(gift_card_order_line.product_uom_qty))]

    def _build_gift_card(self, gift_card_order_line):
        return {
            'amount': gift_card_order_line.order_id.currency_id._convert(
                gift_card_order_line.price_unit,
                self.env.company.currency_id,
                self.env.company, fields.Date.today()
            ),
            'sale_order_id': self.id,
        }

    def _send_gift_card_mail(self):
        template = self.env.ref('wallet.mail_template_gift_card', raise_if_not_found=False)
        if template:
            self = self.with_user(SUPERUSER_ID)
            self.message_post_with_template(
                template.id, composition_mode='comment',
                model='sale.order', res_id=self.id,
                email_layout_xmlid='mail.mail_notification_light',
            )

    def reload_wallet_payment(self):
        return self.order_line_wallet_id and (
                self.amount_total == 0
                or float_compare(self.wallet_balance + self.order_line_wallet_id.price_unit, 0.0,
                                 precision_rounding=2) > 0
        )


class SaleOrderLine(models.Model):
    # Inherited Fields
    _inherit = "sale.order.line"

    is_wallet_payment = fields.Boolean(default=False)

    def is_not_a_product_line(self):
        return super(SaleOrderLine, self).is_not_a_product_line() \
               or self.is_wallet_payment
