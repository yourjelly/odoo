# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models
from odoo.osv import expression


class Snippet(models.Model):
    _inherit = 'snippet'

    # maybe add website_id for custom snippets?
    used_for = fields.Selection(selection_add=[
        ('website_builder', 'Website Builder')
    ])

    @api.model
    def _save_custom_values_hook(self):
        res = super()._save_custom_values_hook()
        website_id = self.env.context.get('website_id')
        if website_id:
            res['website_id'] = website_id
        return res

    @api.model
    def _save_custom_domain_hook(self):
        domain = super()._save_custom_domain_hook()
        website_id = self.env.context.get('website_id')
        if website_id:
            current_website = self.env['website'].browse(website_id)
            domain = expression.AND([domain, current_website.website_domain()])
        return domain


class SnippetCategory(models.Model):
    _inherit = 'snippet.category'

    used_for = fields.Selection(selection_add=[
        ('website_builder', 'Website Builder')
    ])
