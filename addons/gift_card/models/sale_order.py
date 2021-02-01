# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import _, api, fields, models, SUPERUSER_ID


class SaleOrder(models.Model):
    _inherit = "sale.order"

    generated_gift_card_count = fields.Integer(compute="_compute_generated_gift_card_count")

    # Compute & constrains Func
    @api.depends("order_line.generated_gift_card_ids")
    def _compute_generated_gift_card_count(self):
        for record in self:
            record.generated_gift_card_count = sum(
                [len(gcs) for gcs in record.order_line.mapped("generated_gift_card_ids")]
            )

    @api.constrains('state')
    def _constrains_state(self):
        for record in self.filtered(lambda so: so.state == 'cancel'):
            record.order_line.filtered(lambda ol: ol.is_gift_card_payment).unlink()
        for record in self.filtered(lambda so: so.state == 'sale'):
            for gift_card_oder_line in record.order_line.filtered(lambda ol: ol.product_id.is_gift_card):
                record._create_gift_cards(gift_card_oder_line)
            record._send_gift_card_mail()

    # Logic
    def recompute_gift_card_lines(self):
        for record in self:
            previous_retain = 0
            lines_to_remove = self.env['sale.order.line']
            lines_to_update = []
            for line in record.order_line \
                    .filtered(lambda l: l.is_gift_card_payment) \
                    .sorted(lambda line: line.payed_with_gift_card_id.expired_date):
                can_be_retained = line.payed_with_gift_card_id \
                    .how_much_can_be_retained(record.get_total_amount(previous_retain),
                                              record.currency_id)
                if can_be_retained <= 0:
                    lines_to_remove += line
                else:
                    previous_retain += can_be_retained
                    if line.price_unit != - can_be_retained or line.product_uom_qty != 1:
                        lines_to_update.append((1, line.id, {'price_unit': - can_be_retained, 'product_uom_qty': 1}))
            lines_to_remove.unlink()
            record.update({'order_line': lines_to_update})

    def pay_with_gift_card(self, gift_card):
        if not gift_card.is_valid():
            return {
                'is_error': True,
                'message': _('Invalid or Expired Gift Card code.')
            }
        if self.is_used(gift_card):
            return {
                'is_error': True,
                'message': _('Gift Card already used.')
            }
        can_be_retained = gift_card.how_much_can_be_retained(self.get_total_amount(with_gift_card_payment=True), self.currency_id)
        if can_be_retained <= 0:
            return {
                'is_error': True,
                'message': _('Total order amount is zero.')
            }
        pay_gift_card_id = self.env['ir.model.data'].xmlid_to_object('gift_card.pay_with_gift_card_product')
        gift_card.release_unconfirmed_line_orders()
        self.env["sale.order.line"].create({
            'product_id': pay_gift_card_id.id,
            'price_unit': - can_be_retained,
            'product_uom_qty': 1,
            'product_uom': pay_gift_card_id.uom_id.id,
            'payed_with_gift_card_id': gift_card.id,
            'order_id': self.id
        })
        return {
            'is_error': False
        }

    def is_used(self, gift_card):
        return gift_card in self.order_line.mapped("payed_with_gift_card_id")

    def get_total_amount(self, previous_retain=0, with_gift_card_payment=False):
        if with_gift_card_payment:
            return sum(self.order_line.mapped('price_total')) - previous_retain
        else:
            return sum(self.order_line.filtered(lambda line: not line.is_gift_card_payment).mapped(
                'price_total')) - previous_retain

    def _create_gift_cards(self, gift_card_order_line):
        return [self.env['gift.card'].create(self._build_gift_card(gift_card_order_line)) for _ in
                range(int(gift_card_order_line.product_uom_qty))]

    def _build_gift_card(self, gift_card_order_line):
        return {
            'initial_amount': gift_card_order_line.order_id.currency_id._convert(
                gift_card_order_line.price_unit,
                self.env.company.currency_id,
                self.env.company, fields.Date.today()
            ),
            'buy_line_id': gift_card_order_line.id,
        }

    def _send_gift_card_mail(self):
        template = self.env.ref('gift_card.mail_template_gift_card', raise_if_not_found=False)
        if template and self.generated_gift_card_count:
            self = self.with_user(SUPERUSER_ID)
            self.message_post_with_template(
                template.id, composition_mode='comment',
                model='sale.order', res_id=self.id,
                email_layout_xmlid='mail.mail_notification_light',
            )


class SaleOrderLine(models.Model):
    # Inherited Fields
    _inherit = "sale.order.line"

    generated_gift_card_ids = fields.One2many('gift.card', "buy_line_id",
                                              string="Bought Gift Card",
                                              copy=False)
    is_gift_card_payment = fields.Boolean(default=False, compute="_compute_is_gift_card_payment")

    payed_with_gift_card_id = fields.Many2one('gift.card',
                                              string="Pay with Gift Card",
                                              copy=False)

    @api.depends("payed_with_gift_card_id")
    def _compute_is_gift_card_payment(self):
        for record in self:
            record.is_gift_card_payment = bool(record.payed_with_gift_card_id)

    def is_not_a_product_line(self):
        return super(SaleOrderLine, self).is_not_a_product_line() or self.is_gift_card_payment
