# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from werkzeug.urls import url_join

from odoo import fields, models, api


class Article(models.Model):
    _name = 'knowledge.article'
    _inherit = ['knowledge.article', 'website.published.multi.mixin']

    share_link = fields.Char('Link', compute='_compute_share_link', store=False, readonly=True)

    def _compute_share_link(self):
        for article in self:
            article.share_link = url_join(article.get_base_url(), 'article/%s' % article.id)

    # Override
    @api.depends('user_permission', 'website_published')
    def _compute_user_has_access(self):
        published_articles = self.filtered(lambda article: article.website_published)
        published_articles.user_has_access = True
        super(Article, (self - published_articles))._compute_user_has_access()

    def _get_additional_access_domain(self):
        return [('website_published', '=', True)]
