# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models, fields

from datetime import datetime
from dateutil.relativedelta import relativedelta
from lxml import html, etree
from urllib.parse import urlparse
import requests


class LinkPreview(models.Model):
    _name = 'mail.link.preview'
    _description = "Store link preview data"

    message_id = fields.Many2one('mail.message', string='Message', index=True, ondelete='cascade')
    guest_id = fields.Many2one('mail.guest', string="Guest")
    og_type = fields.Char('type')
    source_url = fields.Char('url', required=True)
    og_title = fields.Char('title')
    og_image = fields.Char('image')
    og_description = fields.Text('description')
    og_mimetype = fields.Char('mimetype')

    # Some website are blocking non browser user agent. We make ourself like
    # firefox to avoid issue.
    request_headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; rv:91.0) Gecko/20100101 Firefox/91.0'
    }

    def _link_preview_format(self):
        return [{
            'description': preview.og_description,
            'id': preview.id,
            'image_url': preview.og_image,
            'mimetype': preview.og_mimetype,
            'title': preview.og_title,
            'type': preview.og_type,
            'url': preview.source_url,
        } for preview in self]

    @api.model
    def _throttle_link_preview(self, url):
        domain = urlparse(url).netloc
        date_interval = fields.Datetime.to_string((datetime.now() - relativedelta(seconds=10)))
        call = self.search_count([
            ('source_url', 'like', '%' + domain + '%'),
            ('create_date', '>', date_interval),
        ])
        throttle = self.env['ir.config_parameter'].sudo().get_param('mail.link_preview_throttle', 99)
        return call > int(throttle)

    @api.model
    def _create_link_preview(self, url):
        if self._throttle_link_preview(url):
            return False
        link_preview_data = self._get_link_preview_from_url(url)
        if link_preview_data:
            if self.env.user._is_public() and 'guest' in self.env.context:
                link_preview_data['guest_id'] = self.env.context['guest'].id
            return self.sudo().create(link_preview_data)
        return False

    @api.model
    def _get_link_preview_from_url(self, url):
        try:
            response = requests.head(url, timeout=3, headers=self.request_headers)
        except requests.exceptions.RequestException:
            return False

        if response.status_code != requests.codes.ok:
            return False

        image_mimetype = [
            'image/bmp',
            'image/gif',
            'image/jpeg',
            'image/png',
            'image/tiff',
            'image/x-icon',
        ]
        # Content-Type header can return a charset, but we just need the
        # mimetype (eg: image/jpeg;charset=ISO-8859-1)
        content_type = response.headers['Content-Type'].split(';')
        if content_type[0] in image_mimetype:
            return {
                'og_mimetype': content_type[0],
                'og_type': 'image',
                'source_url': url,
            }
        if 'text/html' in response.headers['Content-Type']:
            return self._get_link_preview_from_html(url)
        return False

    def _get_link_preview_from_html(self, url):
        response = requests.get(url, timeout=3, headers=self.request_headers)
        parser = etree.HTMLParser(encoding=response.encoding)
        tree = html.fromstring(response.content, parser=parser)
        og_title = tree.xpath('//meta[@property="og:title"]/@content')
        if og_title:
            og_title = og_title[0]
        og_description = tree.xpath('//meta[@property="og:description"]/@content')
        if og_description:
            og_description = og_description[0]
        if not og_title:
            return False
        og_type = tree.xpath('//meta[@property="og:type"]/@content')
        if og_type:
            og_type = og_type[0]
        og_image = tree.xpath('//meta[@property="og:image"]/@content')
        if og_image:
            og_image = og_image[0]
        og_mimetype = tree.xpath('//meta[@property="og:image:type"]/@content')
        if og_mimetype:
            og_mimetype = og_mimetype[0]
        return {
            'og_description': og_description or False,
            'og_image': og_image or False,
            'og_mimetype': og_mimetype or False,
            'og_title': og_title or False,
            'og_type': og_type or False,
            'source_url': url,
        }

    def _delete_and_notify(self):
        notifications = []
        for link_preview in self:
            if self.message_id:
                channel = self.env['mail.channel'].search([('id', '=', self.message_id.res_id)])
                notifications.append((channel, 'mail.link_preview/delete', {'id': link_preview.id}))
            else:
                notifications.append((self.env.user.partner_id, 'mail.link_preview/delete', {'id': link_preview.id}))
        self.env['bus.bus']._sendmany(notifications)
        self.unlink()

    @api.autovacuum
    def _gc_link_preview(self):
        self.env['mail.link.preview'].search([
            ('message_id', '=', False),
            ('create_date', '<', datetime.now() - relativedelta(days=1))
        ]).unlink()
