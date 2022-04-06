# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import http
from odoo.http import request
from odoo.addons.knowledge.controllers.main import KnowledgeController


class KnowledgeWebsiteController(KnowledgeController):
    # Override
    @http.route('/knowledge/article/<int:article_id>', type='http', auth='public', website=True)
    def redirect_to_article(self, **kwargs):
        return super().redirect_to_article(**kwargs)

    def _fetch_article(self, article_id):
        """ As website_published articles are available for public users, only use user_has_access
        to access the article. """
        article = super(KnowledgeWebsiteController, self)._fetch_article(article_id)
        if article:
            return article
        Article = request.env['knowledge.article']
        article_sudo = Article.browse(article_id).exists().sudo()
        if article_sudo.user_has_access:
            return article_sudo
        return Article

    def _get_root_articles(self, limit=None):
        """ As public users don't have access to article model, get root articles in sudo with adapted domain :
            - Public users only have access to website_published articles.
            To avoid computing user_has_access on articles that public user does not have access to,
            directly uses website_published in the domain to speedup computation.
            For the other users, add user_has_access in domain as they might have access to article not published.
        """
        Article = request.env["knowledge.article"]
        if request.env.user._is_public():
            return Article.sudo().search([("parent_id", "=", False), ('website_published', '=', True)], limit=limit).sorted('sequence')
        else:
            return Article.search([("parent_id", "=", False), ('user_has_access', '=', True)], limit=limit).sorted('sequence')
