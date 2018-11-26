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



    # @http.route(['/slides/add_slide'], type='json', auth='user', methods=['POST'])
    # def create_slide(self, *args, **post):
    #     # check the size only when we upload a file.
    #     if post.get('datas'):
    #         file_size = len(post['datas']) * 3 / 4 # base64
    #         if (file_size / 1024.0 / 1024.0) > 25:
    #             return {'error': _('File is too big. File size cannot exceed 25MB')}
    #
    #     values = dict((fname, post[fname]) for fname in [
    #         'name', 'url', 'mime_type', 'datas', 'index_content'] if post.get(fname))
    #     if post.get('category_id'):
    #         if post['category_id'][0] == 0:
    #             values['category_id'] = request.env['slide.category'].create({
    #                 'name': post['category_id'][1]['name'],
    #                 'channel_id': values.get('channel_id')}).id
    #         else:
    #             values['category_id'] = post['category_id'][0]
    #
    #     # handle exception during creation of slide and sent error notification to the client
    #     # otherwise client slide create dialog box continue processing even server fail to create a slide.
    #     try:
    #         slide_id = request.env['slide.slide'].create(values)
    #     except (UserError, AccessError) as e:
    #         _logger.error(e)
    #         return {'error': e.name}
    #     except Exception as e:
    #         _logger.error(e)
    #         return {'error': _('Internal server error, please try again later or contact administrator.\nHere is the error message: %s') % e}
    #     return {'url': "/slides/slide/%s" % (slide_id.id)}

    # @http.route(['/slides/validate/url'], type='json', auth='user', methods=['POST'])
    # def validate_url(self, **data):
    #     MrpSlide = request.env['mrp.slide.show']
    #     document_type, document_id = MrpSlide._find_document_data_from_url(data['url'])
    #     preview = {}
    #     if not document_id:
    #         preview['error'] = _('Please enter valid youtube or google doc url')
    #         return preview
    #     existing_slide = MrpSlide.search([('res_id', '=', int(data['id'])), ('document_id', '=', document_id)], limit=1)
    #     if existing_slide:
    #         preview['slide'] = existing_slide
    #         return preview
    #     values = MrpSlide._parse_document_url(data['url'])
    #     if values.get('error'):
    #         preview['error'] = _('Could not fetch data from url. Document or access right not available.\nHere is the received response: %s') % values['error']
    #         return preview
    #     return values

    # --------------------------------------------------
    # EMBED IN THIRD PARTY WEBSITES
    # --------------------------------------------------
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
        # Note : don't use the 'model' in the route (use 'slide_id'), otherwise if public cannot access the embedded
        # slide, the error will be the website.403 page instead of the one of the website_slides.embed_slide.
        # Do not forget the rendering here will be displayed in the embedded iframe

        # determine if it is embedded from external web page
        referrer_url = request.httprequest.headers.get('Referer', '')
        base_url = request.env['ir.config_parameter'].sudo().get_param('web.base.url')
        is_embedded = referrer_url and not bool(base_url in referrer_url) or False
        # try accessing slide, and display to corresponding template
        model_info = dict(parse_qsl(kw.get('file')))
        try:
            slide = request.env[model_info.get('model')].browse(int(model_info.get('id')))
            if is_embedded:
                request.env['slide.embed'].sudo().add_embed_url(slide.id, referrer_url)
            # values = self._get_slide_detail(slide)
            values = {
                'slide': slide,
                'page': page,
                'is_embedded': is_embedded,
                'model_info': model_info,
            }
            return request.render('mrp.embed_slide', values)
        except AccessError: # TODO : please, make it clean one day, or find another secure way to detect
                            # if the slide can be embedded, and properly display the error message.
            slide = request.env[model_info.get('model')].sudo().browse(int(model_info.get('id')))
            return request.render('google_slide.embed_slide_forbidden', {'slide': slide})
