# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import uuid

from odoo import api, fields, models
from odoo.osv import expression


class Snippet(models.Model):

    _name = "snippet"
    _description = "Snippet"
    _order = "sequence, name"

    name = fields.Char('Snippet Name', required=True, translate=True)
    key = fields.Char(required=True)
    thumbnail_url = fields.Char(required=True)
    content = fields.Html()
    sequence = fields.Integer(default=10)
    vcss = fields.Integer()
    vjs = fields.Integer()
    keyword_ids = fields.Many2many('snippet.keyword', string='Keywords')
    category_ids = fields.Many2many('snippet.category', string='Categories', help='Right Panel Category')
    used_for = fields.Selection([
        ('shared', 'Shared'),
        ('web_editor', 'Web Editor'),
    ], string='Application', default='shared')
    is_custom = fields.Boolean('Custom Snippet')  # TODO maybe remove this field and add it as a category?

    @api.model
    def save_custom(self, arch, snippet_key, used_for):
        # TODO: send used_for feature instead of template_key (view where to xpath the custom eg website.snippets)
        """
        Saves a new snippet arch so that it appears with the given name when
        using the given snippets template.

        :param arch: the html structure of the snippet to save
        :param snippet_key: the key (without module part) to identify
            the snippet from which the snippet to save originates
        :param used_for: the application (`used_for`) for which the custom
            snippet is created
        """
        original_snippet = self.search([('key', '=', snippet_key), ('used_for', '=', used_for)])
        name = self._find_available_name("Custom %s" % original_snippet.name)
        self.create({
            'name': name,
            'key': '%s_%s' % (snippet_key, uuid.uuid4().hex),
            'thumbnail_url': original_snippet.thumbnail_url,
            'content': arch,
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
    def _get_snippet_addition_view_key(self, template_key, key):
        return '%s.%s' % (template_key, key)

    @api.model
    def rename_custom(self, id, name):
        snippet = self.browse(id)
        snippet.name = self._find_available_name(name)


class SnippetKeyword(models.Model):

    _name = "snippet.keyword"
    _description = "Snippet Keyword"
    _order = 'name'

    name = fields.Char('Keyword Name', required=True, translate=True)
    snippet_ids = fields.Many2many('snippet', string='Snippets')


class SnippetCategory(models.Model):

    _name = "snippet.category"
    _description = "Snippet Category in right panel"
    _order = 'sequence, name'

    name = fields.Char('Category Name', required=True, translate=True)
    sequence = fields.Integer(default=10)
    snippet_ids = fields.Many2many('snippet', string='Snippets')
    used_for = fields.Selection([
        ('shared', 'Shared'),
        ('web_editor', 'Web Editor'),
    ], string='Application', default='shared')
    snippet_count = fields.Integer('# Snippets', compute="_compute_snippet_count")

    @api.depends('snippet_ids')
    def _compute_snippet_count(self):
        for category in self:
            category.snippet_count = len(category.snippet_ids)
