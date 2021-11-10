# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import uuid

from odoo import api, fields, models
from odoo.osv import expression


class SnippetCustom(models.Model):

    _name = "snippet.custom"
    _description = "Snippet Custom"
    _order = "name"

    name = fields.Char('Snippet Name', required=True, translate=True)
    original_key = fields.Char(required=True)
    thumbnail_url = fields.Char(required=True)
    content = fields.Html()

    @api.model
    def save_custom(self, name, arch, snippet_key, thumbnail_url):
        """
        Saves a new snippet arch so that it appears with the given name when
        using the given snippets template.

        :param arch: the html structure of the snippet to save
        :param snippet_key: the key (without module part) to identify
            the snippet from which the snippet to save originates
        """
        name = self._find_available_name(f"Custom {name}")
        self.create({
            **{
                'name': name,
                'original_key': '%s_%s' % (snippet_key, uuid.uuid4().hex),
                'thumbnail_url': thumbnail_url,
                'content': arch,
            }, **self._save_custom_values_hook()
        })

    @api.model
    def _save_custom_domain_hook(self):
        return []

    @api.model
    def _save_custom_values_hook(self):
        return {}

    def _find_available_name(self, name):
        domain = self._save_custom_domain_hook()
        used_names = self.search(expression.AND([
            [('name', '=like', '%s%%' % name)], domain
        ])).mapped('name')

        attempt = 1
        candidate_name = name
        while candidate_name in used_names:
            attempt += 1
            candidate_name = f"{name} ({attempt})"
        return candidate_name

    @api.model
    def rename_custom(self, id, name):
        snippet = self.browse(id)
        snippet.name = self._find_available_name(name)
