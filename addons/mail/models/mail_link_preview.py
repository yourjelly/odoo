# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import logging
import lxml.html
from urllib.request import urlopen

from odoo import api, fields, models

_logger = logging.getLogger(__name__)


class MailLinkPreview(models.Model):
    _name = 'mail.link_preview'
    _rec_name = 'url'

    title = fields.Char()
    url = fields.Char(required=True, index=True)
    image_url = fields.Char()
    description = fields.Char()
    message_ids = fields.One2many('mail.message', 'link_preview_id')

    _sql_constraints = [
        ('mail_link_preview_url_unique', 'UNIQUE(url)', 'The preview of a specific URL must be unique.')
    ]

    @api.model
    def _scrape_preview(self, url):
        tree = lxml.html.fromstring(urlopen(url).read())
        values = {'url': url}
        for metatag in tree.head.findall('meta'):
            if 'property' in metatag.keys() and 'content' in metatag.keys():
                if metatag.values()[0] == 'og:title':
                    values.update(title=metatag.values()[1])
                elif metatag.values()[0] == 'og:description':
                    values.update(description=metatag.values()[1])
                elif metatag.values()[0] == 'og:image':
                    values.update(image_url=metatag.values()[1])
        res = self.create(values)
        return res

    @api.model
    def _cron_process_link_previews(self, limit=10):
        for message in self.env['mail.message'].search([('requires_preview', '=', True)], limit=limit):
            try:
                urls = message._search_for_urls()[0]
                if urls:
                    preview = self.search([('url', '=', urls[0])], limit=1)
                    if not preview:
                        preview = self._scrape_preview(urls[0])
                    message.write({'link_preview_id': preview.id})
            except Exception as e:
                _logger.exception('An error occurred while creating preview for message %d' % message.id)
            finally:
                message.write({'requires_preview': False})
                self.env.cr.commit()

    @api.model
    def _gc(self):
        self.search([('message_ids', '=', False)]).unlink()


class AutoVacuum(models.AbstractModel):
    _inherit = 'ir.autovacuum'

    @api.model
    def power_on(self, *args, **kwargs):
        self.env['mail.link_preview']._gc()
        return super(AutoVacuum, self).power_on(*args, **kwargs)
