# Part of Odoo. See LICENSE file for full copyright and licensing details.

from werkzeug import urls

from odoo import _, fields, Command
from odoo.http import request, route
from odoo.tools.misc import formatLang

from odoo.addons.payment import utils as payment_utils
from odoo.addons.portal.controllers.portal import CustomerPortal, pager as portal_pager


class CustomerPortalLoyalty(CustomerPortal):

    def _prepare_portal_layout_values(self):
        values = super()._prepare_portal_layout_values()
        cards_per_programs = dict(request.env['loyalty.card'].sudo()._read_group(
            domain=[
                ('partner_id', '=', request.env.user.partner_id.id),
                ('program_id.active', '=', True),
                ('program_id.program_type', 'in', ['loyalty', 'ewallet']),
                '|',
                    ('expiration_date', '>=', fields.Date().today()),
                    ('expiration_date', '=', False),
            ],
            groupby=['program_id'],
            aggregates=['id:recordset'],
        ))
        values['cards_per_programs'] = cards_per_programs

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
        [
            '/my/loyalty_card/history/<int:card_id>',
            '/my/loyalty_card/history/<int:card_id>/page/<int:page>',
        ],
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
        history_lines = LoyaltyHistory.sudo().search(
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
            'history_lines': history_lines,
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
                'program_name': dict(
                    card_sudo.program_id._fields['program_type'].selection
                )[program_type],
                "program_type": program_type,
            },
            'history_lines': [{
                'order_id': line.order_id,
                'description': line.description,
                'order_portal_url': line.get_order_portal_url(),
                'points': f'''
                    {'-' if line.issued < line.used else '+'}
                     {card_sudo._format_points(abs(line.issued - line.used))}
                ''',
            } for line in card_sudo.history_ids[:5]],
            'trigger_products': [{
                'id': product.id,
                'list_price': formatLang(
                    request.env,
                    product.lst_price,
                    currency_obj=product.currency_id,
                ),
            } for product in card_sudo.program_id.trigger_product_ids],
            'rewards': [{
                'description': reward.description,
                'points': card_sudo._format_points(reward.required_points),
            } for reward in card_sudo.program_id.reward_ids],
            'img_path': f'/loyalty/static/src/img/{program_type}.svg',
        }

        return response

    @route(['/topup'], type='http', auth="public", website=True, sitemap=False)
    def topup_wallet(self, card_id, product_id):
        product = request.env['product.product'].browse(int(product_id))
        card = request.env['loyalty.card'].browse(int(card_id))
        access_token = payment_utils.generate_access_token(
            request.env.user.partner_id.id, product.list_price, product.currency_id.id
        )
        url_params = {
            'amount': product.list_price,
            'access_token': access_token,
            'currency_id': product.currency_id.id,
            'partner_id': request.env.user.partner_id.id,
            'reference': _("Ewallet-%(point_name)s-%(card_id)s", point_name=card.point_name, card_id=card.id),
        }
        return request.redirect(f'/payment/pay?{urls.url_encode(url_params)}')
