# Part of Odoo. See LICENSE file for full copyright and licensing details.

from collections import defaultdict

from odoo import _, fields
from odoo.http import request, route
from odoo.tools.misc import formatLang

from odoo.addons.portal.controllers.portal import CustomerPortal, pager as portal_pager


class CustomerPortalLoyalty(CustomerPortal):

    def _prepare_portal_layout_values(self):
        values = super()._prepare_portal_layout_values()
        all_cards = request.env['loyalty.card'].sudo().search([
            ('partner_id', '=', request.env.user.partner_id.id),
            ('program_id.active', '=', True),
            ('program_id.program_type', 'in', ['loyalty', 'ewallet']),
            '|', ('expiration_date', '>=', fields.Date().today()), ('expiration_date', '=', False),
        ])
        programs = defaultdict(list)
        for card in all_cards:
            program_type = card.program_id.program_type
            programs[program_type].append(card)
        values['loyalty_programs'] = programs

        return values

    def _get_loyalty_searchbar_sortings(self):
        return {
            'date': {'label': _("Date"), 'order': 'create_date desc'},
            'used': {'label': _("Used"), 'order': 'used desc'},
            'description': {'label': _("Description"), 'order': 'description desc'},
            'issued': {'label': _("Issued"), 'order': 'issued desc'},
            'new_balance': {'label': _("New Balance"), 'order': 'new_balance desc'},
        }

    @route(
        ['/my/loyalty_card/history/<int:card_id>', '/my/loyalty_card/history/<int:card_id>/page/<int:page>'],
        type='http',
        auth="user",
        website=True,
    )
    def portal_my_loyalty_card_history(self, card_id, page=1, sortby='date', **kw):
        LoyaltyHistory = request.env['loyalty.history'].sudo()
        searchbar_sortings = self._get_loyalty_searchbar_sortings()
        order = searchbar_sortings[sortby]['order']
        lines_count = LoyaltyHistory.sudo().search_count([('card_id', '=', card_id)])
        pager = portal_pager(
            url='/my/loyalty_card/history/<int:card_id>',
            url_args={'sortby': sortby, 'card_id': card_id},
            total=lines_count,
            page=page,
            step=self._items_per_page,
        )
        card_history_lines = LoyaltyHistory.sudo().search(
            domain=[('card_id', '=', card_id)],
            order=order,
            limit=self._items_per_page,
            offset=pager['offset'],
        )
        values = {
            'pager': pager,
            'searchbar_sortings': searchbar_sortings,
            'page_name': 'loyalty_history',
            'sortby': sortby,
            'card_history_lines': card_history_lines,
        }

        return request.render('loyalty.loyalty_card_history_template', values)

    @route('/get/loyalty_card/values', type='json', auth='user')
    def get_loyalty_portal_values(self, card_id):
        card_sudo = request.env['loyalty.card'].sudo().search([('id', '=', int(card_id))])
        program_type = card_sudo.program_id.program_type
        response = {
            'card': {
                'id': card_sudo.id,
                'points_display': card_sudo.points_display,
                'expiration_date': card_sudo.expiration_date,
                'code': card_sudo.code,
            },
            'program': {
                'program_name': dict(card_sudo.program_id._fields['program_type'].selection)[program_type],
                "program_type": program_type,
            },
            'history_lines': [{
                'order_id': line.order_id,
                'description': line.description,
                'order_portal_url': line._get_order_portal_url(),
                'points': f'''
                    {'-' if line.issued < line.used else '+'}
                     {card_sudo._format_points(abs(line.issued - line.used))}
                '''
            } for line in card_sudo.history_ids[:5]],
            'trigger_products': [{
                'id': product.id,
                'list_price': formatLang(
                    request.env,
                    product.lst_price,
                    currency_obj=product.currency_id
                ),
            } for product in card_sudo.program_id.trigger_product_ids],
            'rewards': [{
                'description': reward.description,
                'points': card_sudo._format_points(reward.required_points),
            } for reward in card_sudo.program_id.reward_ids],
            'img_path': f'/loyalty/static/src/img/{program_type}.svg',
        }

        return response
