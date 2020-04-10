# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import http
from odoo.http import request
from odoo.tools.translate import _
from odoo.tools.misc import get_lang


class Rating(http.Controller):

    def ask_feedback(self, rating, lang, token):
        rate_names = {
            10: _("satisfied"),
            5: _("not satisfied"),
            1: _("highly dissatisfied")
        }
        return request.env['ir.ui.view'].with_context(lang=lang).render_template('rating.rating_external_page_submit', {
            'rating': rating, 'token': token,
            'rate_names': rate_names, 'rate': rating.rating
        })

    def thank_you(self, rating, lang):
        return request.env['ir.ui.view'].with_context(lang=lang).render_template('rating.rating_external_page_view', {
            'web_base_url': request.env['ir.config_parameter'].sudo().get_param('web.base.url'),
            'rating': rating,
        })

    @http.route([
        '/rating/<string:token>/submit_feedback',
        '/rating/<string:token>/<int:rate>'
    ], type="http", auth="public", methods=['get', 'post'], website=True)
    def submit_rating(self, token, rate=None, feedback=None, **kwargs):
        rate = int(rate)
        if rate not in (1, 5, 10):
            raise ValueError("Incorrect rating value")
        rating = request.env['rating.rating'].sudo().search([('access_token', '=', token)])
        if not rating:
            return request.not_found()
        record_sudo = request.env[rating.res_model].sudo().browse(rating.res_id)
        record_sudo.rating_apply(rate, token=token, feedback=feedback)
        lang = rating.partner_id.lang or get_lang(request.env).code
        if feedback:
            return self.thank_you(rating, lang)
        return self.ask_feedback(rating, lang, token)
