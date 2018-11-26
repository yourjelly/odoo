# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import io
import requests
import re
import base64
from PIL import Image

from odoo import api, fields, models, _
from odoo.exceptions import Warning
from odoo.http import request
from odoo.addons.http_routing.models.ir_http import url_for
from odoo.addons.http_routing.models.ir_http import slug


class MrpRoutingWorkcenter(models.Model):
    _inherit = "mrp.routing.workcenter"

    url = fields.Char('worksheet URL')
    index_content = fields.Text('Transcript')
    document_id = fields.Char('Document ID', help="Youtube or Google Document ID")
    mime_type = fields.Char('Mime-type')
    embed_code = fields.Text('Embed Code', readonly=True, compute='_get_embed_code')

    def _get_embed_code(self):
        base_url = request and request.httprequest.url_root or self.env['ir.config_parameter'].sudo().get_param('web.base.url')
        if base_url[-1] == '/':
            base_url = base_url[:-1]
        for record in self:
            if record.worksheet and (not record.document_id or record.slide_type in ['document', 'presentation']):
                slide_url = base_url + url_for('/slides/embed/%s?page=1' % record.id)
                record.embed_code = '<iframe src="%s" class="o_wslides_iframe_viewer" allowFullScreen="true" height="%s" width="%s" frameborder="0"></iframe>' % (slide_url, 315, 420)
            elif record.slide_type == 'video' and record.document_id:
                if not record.mime_type:
                    # embed youtube video
                    record.embed_code = '<iframe src="//www.youtube.com/embed/%s?theme=light" allowFullScreen="true" frameborder="0"></iframe>' % (record.document_id)
                else:
                    # embed google doc video
                    record.embed_code = '<iframe src="//drive.google.com/file/d/%s/preview" allowFullScreen="true" frameborder="0"></iframe>' % (record.document_id)
            else:
                record.embed_code = False

    # @api.onchange('url')
    # def on_change_url(self):
    #     self.ensure_one()
    #     if self.url:
    #         res = self._parse_document_url(self.url)
    #         if res.get('error'):
    #             raise Warning(_('Could not fetch data from url. Document or access right not available:\n%s') % res['error'])
    #         values = res['values']
    #         if not values.get('document_id'):
    #             raise Warning(_('Please enter valid Youtube or Google Doc URL'))
    #         for key, value in values.items():
    #             self[key] = value

    @api.model
    def _fetch_data(self, base_url, data, content_type=False, extra_params=False):
        result = {'values': dict()}
        try:
            response = requests.get(base_url, params=data)
            response.raise_for_status()
            if content_type == 'json':
                result['values'] = response.json()
            elif content_type in ('image', 'pdf'):
                result['values'] = base64.b64encode(response.content)
            else:
                result['values'] = response.content
        except requests.exceptions.HTTPError as e:
            result['error'] = e.response.content
        except requests.exceptions.ConnectionError as e:
            result['error'] = str(e)
        return result

    def _find_document_data_from_url(self, url):
        # expr = re.compile(r'^.*((youtu.be/)|(v/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#\&\?]*).*')
        # arg = expr.match(url)
        # document_id = arg and arg.group(7) or False
        # if document_id:
        #     return ('youtube', document_id)

        expr = re.compile(r'(^https:\/\/docs.google.com|^https:\/\/drive.google.com).*\/d\/([^\/]*)')
        arg = expr.match(url)
        document_id = arg and arg.group(2) or False
        if document_id:
            return ('google', document_id)

        return (None, False)

    def _parse_document_url(self, url, only_preview_fields=False):
        document_source, document_id = self._find_document_data_from_url(url)
        if document_source and hasattr(self, '_parse_%s_document' % document_source):
            return getattr(self, '_parse_%s_document' % document_source)(document_id, only_preview_fields)
        return {'error': _('Unknown document')}

    @api.model
    def _parse_google_document(self, document_id, only_preview_fields):
        # def get_slide_type(vals):
        #     # TDE FIXME: WTF ??
        #     slide_type = 'presentation'
        #     if vals.get('image'):
        #         image = Image.open(io.BytesIO(base64.b64decode(vals['image'])))
        #         width, height = image.size
        #         if height > width:
        #             return 'document'
        #     return slide_type

        # Google drive doesn't use a simple API key to access the data, but requires an access
        # token. However, this token is generated in module google_drive, which is not in the
        # dependencies of website_slides. We still keep the 'key' parameter just in case, but that
        # is probably useless.
        params = {}
        params['projection'] = 'BASIC'
        if 'google.drive.config' in self.env:
            access_token = self.env['google.drive.config'].get_access_token()
            if access_token:
                params['access_token'] = access_token
        # if not params.get('access_token'):
        #     params['key'] = self.env['website'].get_current_website().website_slide_google_app_key

        fetch_res = self._fetch_data('https://www.googleapis.com/drive/v2/files/%s' % document_id, params, "json")
        if fetch_res.get('error'):
            return fetch_res

        google_values = fetch_res['values']
        # if only_preview_fields:
        #     return {
        #         'url_src': google_values['thumbnailLink'],
        #         'title': google_values['title'],
        #     }

        values = {
            'mime_type': google_values['mimeType'],
            'document_id': document_id,
        }
        # if google_values['mimeType'].startswith('video/'):
        #     values['slide_type'] = 'video'
        if google_values['mimeType'].startswith('image/'):
            values['worksheet'] = values['image']
            # values['slide_type'] = 'infographic'
        elif google_values['mimeType'].startswith('application/vnd.google-apps'):
            if 'exportLinks' in google_values:
                values['worksheet'] = self._fetch_data(google_values['exportLinks']['application/pdf'], params, 'pdf', extra_params=True)['values']
                # Content indexing
                # if google_values['exportLinks'].get('text/plain'):
                #     values['index_content'] = self._fetch_data(google_values['exportLinks']['text/plain'], params, extra_params=True)['values']
                # elif google_values['exportLinks'].get('text/csv'):
                #     values['index_content'] = self._fetch_data(google_values['exportLinks']['text/csv'], params, extra_params=True)['values']
        elif google_values['mimeType'] == 'application/pdf':
            # TODO: Google Drive PDF document doesn't provide plain text transcript
            values['worksheet'] = self._fetch_data(google_values['webContentLink'], {}, 'pdf')['values']
            # values['slide_type'] = get_slide_type(values)

        return {'values': values}

    @api.model
    def create(self, values):
        if values.get('url') and not values.get('document_id'):
            doc_data = self._parse_document_url(values['url']).get('values', dict())
            if doc_data.get('error'):
                raise Warning(_('Could not fetch data from url. Document or access right not available:\n%s') % doc_data['error'])
            if not doc_data.get('document_id'):
                raise Warning(_('Please enter valid Google Slide URL'))
            for key, value in doc_data.items():
                values.setdefault(key, value)
        return super(MrpRoutingWorkcenter, self).create(values)

    @api.multi
    def write(self, values):
        if values.get('url') and values['url'] != self.url:
            doc_data = self._parse_document_url(values['url']).get('values', dict())
            doc_data = self._parse_document_url(values['url']).get('values', dict())
            if doc_data.get('error'):
                raise Warning(_('Could not fetch data from url. Document or access right not available:\n%s') % doc_data['error'])
            if not doc_data.get('document_id'):
                raise Warning(_('Please enter valid Google Slide URL'))
            for key, value in doc_data.items():
                values.setdefault(key, value)
            if not values.get('worksheet'):
                values['worksheet'] = False
        if values.get('worksheet') and not values.get('url'):
            values['url'] = False
        return super(MrpRoutingWorkcenter, self).write(values)
