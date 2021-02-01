# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import http
from odoo.http import request
from odoo.addons.website_sale.controllers import main


class GiftCardController(main.WebsiteSale):

    @http.route('/shop/pay_with_gift_card', type='http', methods=['POST'], website=True, auth='public')
    def add_gift_card(self, gift_card_code, **post):
        redirect = post.get('r', '/shop/cart')
        gift_card = request.env["gift.card"].sudo().search([('code', '=', gift_card_code.strip())], limit=1)
        order = request.env['website'].get_current_website().sale_get_order()
        gift_card_status = order.pay_with_gift_card(gift_card)
        if gift_card_status['is_error']:
            return request.redirect(f"{redirect}?gift_card_error={gift_card_status['message']}")
        return request.redirect(redirect)

    @http.route(['/shop/payment'], type='http', auth="public", website=True)
    def payment(self, **post):
        order = request.website.sale_get_order()
        order.recompute_gift_card_lines()
        return super(GiftCardController, self).payment(**post)

    @http.route(['/shop/cart'], type='http', auth="public", website=True)
    def cart(self, **post):
        order = request.website.sale_get_order()
        order.recompute_gift_card_lines()
        return super(GiftCardController, self).cart(**post)
