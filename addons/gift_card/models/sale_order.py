# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import _, api, fields, models


class SaleOrder(models.Model):
    _inherit = "sale.order"

    gift_card_count = fields.Integer(compute="_compute_gift_card_count")

    @api.depends("order_line.product_id", "order_line.product_uom_qty")
    def _compute_gift_card_count(self):
        for record in self:
            record.gift_card_count = sum(record.order_line.filtered('product_id.is_gift_card').mapped('product_uom_qty'))

    @api.constrains('state')
    def _constrains_state(self):
        # release gift card amount when order state become canceled
        for record in self.filtered(lambda so: so.state == 'cancel'):
            record.order_line.filtered(lambda ol: ol.gift_card_id).unlink()

        # create and send gift card when order become confirmed
        for record in self.filtered(lambda so: so.state == 'sale'):
            for gift_card_oder_line in record.order_line.filtered(lambda ol: ol.product_id.is_gift_card):
                gift_card_oder_line._create_gift_cards()
            record.sudo()._send_gift_card_mail()

    def _pay_with_gift_card(self, gift_card):
        error = False

        amount = min(self.price_total, gift_card.balance_converted(self.currency_id))
        if not gift_card.can_be_used():
            error = _('Invalid or Expired Gift Card code.')
        elif gift_card in self.order_line.mapped("gift_card_id"):
            error = _('Gift Card already used.')
        elif gift_card.partner_id and gift_card.partner_id != self.env.user.partner_id:
            error = _('Gift Card are restricted for another user.')
        elif amount <= 0:
            error = _('Total order amount is zero.')

        if not error:
            pay_gift_card_id = self.env.ref('gift_card.pay_with_gift_card_product')
            self.redeem_line_ids.filtered(lambda redeem: redeem.state != "sale").unlink()
            self.env["sale.order.line"].create({
                'product_id': pay_gift_card_id.id,
                'price_unit': - amount,
                'product_uom_qty': 1,
                'product_uom': pay_gift_card_id.uom_id.id,
                'gift_card_id': gift_card.id,
                'order_id': self.id
            })
        return error

    def _send_gift_card_mail(self):
        template = self.env.ref('gift_card.mail_template_gift_card', raise_if_not_found=False)
        if template and self.gift_card_count:
            self.message_post_with_template(
                template.id, composition_mode='comment',
                model='sale.order', res_id=self.id,
                email_layout_xmlid='mail.mail_notification_light',
            )

    def _recompute_gift_card_lines(self):
        for record in self:
            lines_to_remove = self.env['sale.order.line']
            lines_to_update = []

            gift_payment_lines = record.order_line.filtered('gift_card_id')
            to_pay = (self.order_line - gift_payment_lines).mapped('price_total')

            # consume older gift card first
            for gift_card_line in gift_payment_lines.sorted('gift_card_id.expired_date'):
                amount = min(to_pay, gift_card_line.gift_card_id.balance_converted(record.currency_id))
                if amount:
                    to_pay -= amount
                    if gift_card_line.price_unit != -amount or gift_card_line.product_uom_qty != 1:
                        lines_to_update.append(
                            fields.Command.update(gift_card_line.id, {'price_unit': -amount, 'product_uom_qty': 1})
                        )
                else:
                    lines_to_remove += gift_card_line
            lines_to_remove.unlink()
            record.update({'order_line': lines_to_update})


class SaleOrderLine(models.Model):
    # Inherited Fields
    _inherit = "sale.order.line"

    generated_gift_card_ids = fields.One2many('gift.card', "buy_line_id", string="Bought Gift Card")
    gift_card_id = fields.Many2one('gift.card', help="Deduced from this Gift Card", copy=False)

    def _is_not_sellable_line(self):
        return self.gift_card_id or super(SaleOrderLine, self)._is_not_sellable_line()

    def _create_gift_cards(self):
        return self.env['gift.card'].create(
            [self._build_gift_card(self) for _ in range(int(self.product_uom_qty))]
        )

    def _build_gift_card(self):
        return {
            'initial_amount': self.order_id.currency_id._convert(
                self.price_unit,
                self.order_id.env.company.currency_id,
                self.order_id.env.company,
                fields.Date.today()
            ),
            'buy_line_id': self.id,
        }
