# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.portal.controllers.portal import CustomerPortal
from odoo.addons.portal.controllers.portal import pager as portal_pager
from odoo import http, _, fields
from odoo.http import request


class CustomerPortalLoyalty(CustomerPortal):

    def _program_type_mapping(self, value):
        mapping = {
            'loyalty': 'Loyalty Card',
            'ewallet': 'E-Wallet',
        }
        return mapping.get(value, False)

    def _prepare_portal_layout_values(self):
        record = super()._prepare_portal_layout_values()

        all_cards = request.env['loyalty.card'].sudo().search([
            ('partner_id', '=', request.env.user.partner_id.id),
            ("program_id.active", '=', True),
            '|', ('expiration_date', '>=', fields.Date().today()), ('expiration_date', '=', False)
        ])
        programs = {}
        for card in all_cards:
            program_type = self._program_type_mapping(card.program_id.program_type)
            if program_type:
                programs.setdefault(program_type, []).append(card)

        record['loyalty_programs'] = programs
        return record

    def _get_loyalty_searchbar_sortings(self):
        return {
            'date': {'label': _('Date'), 'order': 'date desc'},
            'used': {'label': _('Used'), 'order': 'used desc'},
            'description': {'label': _('Description'), 'order': 'description desc'},
            'issued': {'label': _('Issued'), 'order': 'issued desc'},
            'new balance': {'label': _('New Balance'), 'order': 'new_balance desc'},
        }

    @http.route(['/my/history', '/my/history/page/<int:page>'], type='http', auth="user", website=True)
    def portal_my_history(self, page=1, date_begin=None, date_end=None, sortby='date', coupon_id=None, **kw):
        loyaltyHistory = request.env['loyalty.history']
        coupon_id = int(coupon_id) if coupon_id else None
        # default sort by order
        searchbar_sortings = self._get_loyalty_searchbar_sortings()
        order = searchbar_sortings[sortby]['order']

        domain = [
            ('card_id', '=', coupon_id),
            ('card_id.partner_id', '=', request.env.user.partner_id.id),
            '|', ('card_id.expiration_date', '>=', fields.Date().today()), ('card_id.expiration_date', '=', False)
        ]

        values = {
            'pager': {
                "url": '/my/history',
                "url_args": {'date_begin': date_begin, 'date_end': date_end, 'sortby': sortby},
                "total": loyaltyHistory.sudo().search_count(domain),
                "page": page,
                "step": self._items_per_page,
            },
            'searchbar_sortings': searchbar_sortings,
            'page_name': 'loyalty_history',
            'sortby': sortby,
            'move_lines': loyaltyHistory.sudo().search(domain, order=order, limit=self._items_per_page, offset=0)
        }
        values['pager'] = portal_pager(**values['pager'])
        return request.render("loyalty.portal_my_history", values)

    @http.route(['/my/loyaltyPortalValues'], type='json', auth='user')
    def get_loyaltyPortalValues(self, card_id):
        card_sudo = request.env['loyalty.card'].sudo().search([
            ("id", "=", int(card_id)),
            ("partner_id", "=", request.env.user.partner_id.id),
            '|', ('expiration_date', '>=', fields.Date().today()), ('expiration_date', '=', False)
        ])
        response = {
            'card': {
                'id': card_sudo.id,
                'points_display': card_sudo.points_display,
                'expiration_date': card_sudo.expiration_date,
                'code': card_sudo.code,
            },
            'program': card_sudo.program_id.display_name,
            'history_lines': [
                {
                    "order_id": line.order_id,
                    "order_name": line.order_id._name if line.order_id else None,
                    "description": line.description,
                    "order_portal_url": line.order_id.get_portal_url() if line.order_id else None,
                    "used": f"{'-' if line.issued < line.used else ''} {card_sudo._format_points(abs(line.issued - line.used))}"
                } for line in card_sudo.history_ids[:5]
            ],
            'trigger_products': [
                {
                    "id": product.id,
                    "list_price": product.list_price,
                    "currency_id": product.currency_id,
                } for product in card_sudo.program_id.trigger_product_ids
            ],
            'rewards': [
            {
                "description": reward.description,
                "points": card_sudo._format_points(reward.required_points),
            }for reward in card_sudo.program_id.reward_ids],
        }
        return response
