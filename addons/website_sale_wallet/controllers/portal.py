# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import http
from odoo.addons.portal.controllers.portal import CustomerPortal
from odoo.addons.portal.controllers.portal import pager as portal_pager
from odoo.http import request


class GiftCardCustomerPortal(CustomerPortal):

    def _prepare_home_portal_values(self, counters):
        values = super()._prepare_home_portal_values(counters)
        if 'wallet_balance' in counters:
            partner = request.env.user.partner_id
            wallet = partner.get_wallet()
            values['wallet_balance'] = f"{wallet.balance} {wallet.currency_id.name or ''}"
        return values

    @http.route(['/my/wallet_transactions', '/my/wallet_transactions/page/<int:page>'], type='http', auth="user",
                website=True)
    def portal_my_transactions_wallet(self, page=1, **kw):
        values = self._prepare_portal_layout_values()
        partner = request.env.user.partner_id

        wallet = partner.get_wallet()
        wallet_transactions_count = wallet.wallet_transactions_count

        pager = portal_pager(
            url="/my/wallet_transactions",
            total=wallet_transactions_count,
            page=page,
            step=self._items_per_page
        )

        values.update({
            'wallet': wallet,
            'page_name': 'wallet_transactions',
            'default_url': '/my/wallet_transactions',
            'pager': pager,
        })
        return request.render("website_sale_wallet.portal_my_wallet_transactions", values)
