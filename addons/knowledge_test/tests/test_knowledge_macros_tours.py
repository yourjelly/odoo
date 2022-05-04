# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests.common import new_test_user, tagged, HttpCase

import base64

@tagged('knowledge_tests')
class TestKnowledgeMacrosTours(HttpCase):
    def test_knowledge_main_flow(self):
        new_test_user(self.env, login="knowledgeManager", groups="base.group_user,base.group_partner_manager")
        file_article_id = self.env['knowledge.article'].article_create()
        file_article = self.env['knowledge.article'].browse(file_article_id)
        file_article.write({
            'name': 'fileArticle'
        })
        html = '<main><p>myFile</p></main>'
        bodies = self.env['ir.actions.report']._prepare_html(html)[0]
        knowledgeFile_pdf = self.env['ir.actions.report']._run_wkhtmltopdf(bodies)
        self.env['ir.attachment'].create({
            'type': 'binary',
            'name': 'knowledgeFile.pdf',
            'res_id': file_article_id,
            'res_model': 'knowledge.article',
            'datas': base64.encodebytes(knowledgeFile_pdf),
        })
        self.start_tour('/web', 'tour_knowledge_main_flow', login="knowledgeManager")
