# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import werkzeug
from werkzeug.utils import redirect

from odoo import http
from odoo.addons.knowledge.controllers.main import KnowledgeController
from odoo.http import request


class KnowledgeWebsiteController(KnowledgeController):
    # Override
    @http.route('/article/<int:article_id>', type='http', auth='public', website=True)
    def redirect_to_article(self, article_id, **post):
        article = request.env['knowledge.article'].browse(article_id)
        if not article.exists():
            return werkzeug.exceptions.NotFound()
        article = article.sudo()
        if not article.user_has_access:
            return werkzeug.exceptions.Forbidden()
        if request.env.user.has_group('base.group_user'):
            return redirect("/web#id=%s&model=knowledge.article&action=%s&menu_id=%s" % (
                article.id,
                request.env.ref('knowledge.knowledge_article_dashboard_action').id,
                request.env.ref('knowledge.knowledge_menu_root').id
            ))
        values = self._prepare_article_frontend_values(article, **post)
        values.update({
            'show_favorite': not request.env.user._is_public()
        })
        return request.render('knowledge.knowledge_article_view_frontend', values)
