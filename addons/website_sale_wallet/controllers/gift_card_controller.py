# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import http
from odoo.http import request


class GiftCardController(http.Controller):

    @http.route('/shop/add_gift_card', type='http', methods=['POST'], website=True, auth='user')
    def add_gift_card(self, gift_card_code, **post):
        redirect = post.get('r', '/shop/payment')
        partner_id = request.env.user.partner_id
        gift_card = request.env["gift.card"].sudo().search([('code', '=', gift_card_code.strip())], limit=1)
        gift_card_status = request.env['gift.card.apply.code'].sudo().add_gift_card(gift_card, partner_id)
        if gift_card_status.get("not_found"):
            return request.redirect(f"{redirect}?gift_card_code_not_available=1")
        return request.redirect(redirect)

    @http.route('/shop/pay_with_wallet', type='http', website=True, auth='user')
    def pay_with_wallet(self, **kw):
        redirect = kw.get('r', '/shop/payment')
        order = request.env['website'].get_current_website().sale_get_order()
        partner = request.env.user.partner_id
        pay_with_wallet = request.env['gift.card.apply.code'].sudo().pay_with_wallet(partner, order)
        if pay_with_wallet:
            return request.redirect(f"{redirect}?pay_with_wallet=1")
        else:
            return request.redirect(f"{redirect}?pay_with_wallet=0")
