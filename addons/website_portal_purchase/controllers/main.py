# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import http
from odoo.exceptions import AccessError
from odoo.http import request

from odoo.addons.website_portal.controllers.main import website_account


class website_account(website_account):

    @http.route()
    def account(self, **kw):
        """ Add purchase orders to main account page """
        response = super(website_account, self).account(**kw)
        partner = request.env.user.partner_id

        PurchaseOrder = request.env['purchase.order']
        purchase_order_count = PurchaseOrder.search_count(['|',
            ('message_partner_ids', 'child_of', [partner.commercial_partner_id.id]),
            ('partner_id', 'child_of', [partner.commercial_partner_id.id]),
            ('state', 'in', ['purchase', 'done', 'cancel'])
        ])
        response.qcontext.update({
            'purchase_order_count': purchase_order_count,
        })
        return response

    @http.route(['/my/purchase-orders', '/my/purchase-orders/page/<int:page>'], type='http', auth="user", website=True)
    def portal_my_purchase_orders(self, page=1, date_begin=None, date_end=None, **kw):
        values = self._prepare_portal_layout_values()
        partner = request.env.user.partner_id
        PurchaseOrder = request.env['purchase.order']

        domain = [
            '|',
            ('message_partner_ids', 'child_of', [partner.commercial_partner_id.id]),
            ('partner_id', 'child_of', [partner.commercial_partner_id.id]),
            ('state', 'in', ['purchase', 'done', 'cancel'])
        ]

        archive_groups = self._get_archive_groups('purchase.order', domain)
        if date_begin and date_end:
            domain += [('create_date', '>', date_begin), ('create_date', '<=', date_end)]

        # count for pager
        purchase_order_count = PurchaseOrder.search_count(domain)
        # make pager
        pager = request.website.pager(
            url="/my/purchase-orders",
            url_args={'date_begin': date_begin, 'date_end': date_end},
            total=purchase_order_count,
            page=page,
            step=self._items_per_page
        )
        # search the purchase orders to display, according to the pager data
        purchases = PurchaseOrder.search(
            domain,
            limit=self._items_per_page,
            offset=pager['offset']
        )
        values.update({
            'date': date_begin,
            'purchases': purchases,
            'pager': pager,
            'archive_groups': archive_groups,
            'default_url': '/my/purchase-orders',
        })
        return request.render("website_portal_purchase.portal_my_purchase_orders", values)

    @http.route(['/my/purchase-orders/<int:purchase>'], type='http', auth="user", website=True)
    def portal_my_purchase_order(self, purchase=None, **kw):
        purchase = request.env['purchase.order'].browse([purchase])
        try:
            purchase.check_access_rights('read')
            purchase.check_access_rule('read')
        except AccessError:
            return request.render("website.403")
        return request.render("website_portal_purchase.portal_my_purchase_order", {
            'purchase': purchase.sudo(),
        })
