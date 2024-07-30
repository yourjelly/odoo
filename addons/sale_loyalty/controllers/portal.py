from werkzeug import urls

from odoo import http, Command
from odoo.http import request

from odoo.addons.sale.controllers.portal import CustomerPortal as portal
from odoo.addons.payment import utils as payment_utils


class CustomerPortal(portal):
    def _get_portal_loyalty_values(self, order):
        values = super()._get_portal_loyalty_values(order)
        if 'loyalty_card' in order.loyalty_total:
            values['loyalty_card'] = order.loyalty_total['loyalty_card']
            values['point_name'] = order.loyalty_total['point_name']
        return values

    @http.route(['/topup'], type='http', auth="public", website=True, sitemap=False)
    def topup_wallet(self, product=None):
        order = request.env['sale.order'].sudo().create({
            'partner_id': request.env.user.partner_id.id,
            'order_line': [
                Command.create({
                    'product_id': int(product),
                })
            ]
        })
        access_token = payment_utils.generate_access_token(
            order.partner_id.id, order.amount_total, order.currency_id.id
        )
        url_params = {
            'amount': order.amount_total,
            'access_token': access_token,
            'currency_id': order.currency_id.id,
            'partner_id': order.partner_id.id,
            'company_id': order.company_id.id,
            'sale_order_id': order.id,
        }
        order.action_preview_sale_order()
        return request.redirect(f'/payment/pay?{urls.url_encode(url_params)}')
