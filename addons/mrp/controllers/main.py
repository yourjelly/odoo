# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import base64
import logging
import werkzeug
from urllib.parse import parse_qsl

from odoo import http, _
from odoo.exceptions import AccessError, UserError
from odoo.http import request
from odoo.addons.http_routing.models.ir_http import slug
from odoo.addons.website.models.ir_http import sitemap_qs2dom

_logger = logging.getLogger(__name__)


class GoogleSlides(http.Controller):
    _slides_per_page = 12
    _slides_per_list = 20

    @http.route(['/slides/viewer'], type='http', auth="user")
    def slide_viewer(self, **post):
        slide = request.env[post.get('model')].browse(int(post.get('id')))
        values = {
            'slide': slide,
        }
        return request.render('mrp.slide_view', values)

    @http.route('''/slides/slide/pdf_content''', type='http', auth="user")
    def slide_get_pdf_content(self, **kw):
        response = werkzeug.wrappers.Response()
        model_info = dict(parse_qsl(kw.get('file')))
        if model_info.get('model'):
            slide = request.env[model_info.get('model')].browse(int(model_info.get('id')))
            if hasattr(slide, model_info.get('field')):
                datas = getattr(slide, model_info.get('field'))
                response.data = datas and base64.b64decode(datas) or b''
                response.mimetype = 'application/pdf'
                return response

    @http.route('/slides/embed', type='http', auth='user')
    def slides_embed(self, page="1", **kw):
        referrer_url = request.httprequest.headers.get('Referer', '')
        base_url = request.env['ir.config_parameter'].sudo().get_param('web.base.url')
        is_embedded = referrer_url and not bool(base_url in referrer_url) or False
        # try accessing slide, and display to corresponding template
        model_info = dict(parse_qsl(kw.get('file')))
        try:
            slide = request.env[model_info.get('model')].browse(int(model_info.get('id')))
            if is_embedded:
                request.env['slide.embed'].sudo().add_embed_url(slide.id, referrer_url)
            values = {
                'slide': slide,
                'page': page,
                'is_embedded': is_embedded,
                'model_info': model_info,
            }
            return request.render('mrp.embed_slide', values)
        except AccessError:
            slide = request.env[model_info.get('model')].sudo().browse(int(model_info.get('id')))
            return request.render('google_slide.embed_slide_forbidden', {'slide': slide})
