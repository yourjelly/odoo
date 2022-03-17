# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models


class Article(models.Model):
    _name = 'knowledge.article'
    _inherit = [
        'knowledge.article',
        'website.published.mixin'
    ]

    # Override
    def _compute_user_has_access(self):
        published_articles = self.filtered_domain([
            ('is_published', '=', True)
        ])
        for article in published_articles:
            article.user_has_access = True
        super(Article, self - published_articles)._compute_user_has_access()
