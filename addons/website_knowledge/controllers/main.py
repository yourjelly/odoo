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

    @http.route('/knowledge/article', type='http', auth='public', website=True)
    def access_knowledge_home(self):
        return super().access_knowledge_home()
