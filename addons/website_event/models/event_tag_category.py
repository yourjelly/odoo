# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class EventTagCategory(models.Model):
    _name = 'event.tag.category'
    _inherit = ['event.tag.category', 'website.published.mixin']

    def default_get(self, fields_list):
        result = super().default_get(fields_list)
        if self.env.context.get('propagate_website_id'):
            result['website_id'] = self.env.context.get('propagate_website_id')
        return result

    def _default_is_published(self):
        return True

    website_id = fields.Many2one('website', string='Website')
