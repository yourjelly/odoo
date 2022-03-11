# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests.common import tagged, TransactionCase


@tagged('knowledge_toc')
class TestKnowledgeArticleTOC(TransactionCase):
    def create_article(self, body):
        """
        Creates a new article with basic read permission for admin
        :param body (string): Body of the article (in HTML)
        """
        return self.env['knowledge.article'].create({
            'name': 'Test Article',
            'body': body,
            'internal_permission': 'read',
            'article_member_ids': [
                (0, 0, {
                    'partner_id': self.env.ref('base.partner_admin').id,
                    'permission': 'write'
                })
            ]
        })

    def test_basic_article(self):
        article = self.create_article('''
            <h1>Title 1</h1>
            <h2>Title 1.1</h2>
            <h3>Title 1.1.1</h3>
            <h3>Title 1.1.2</h3>
            <h3>Title 1.1.3</h3>
            <h2>Title 1.2</h2>
            <h1>Title 2</h1>
        ''')
        self.assertEqual(article.get_toc(), [{
            'name': 'Title 1',
            'children': [{
                'name': 'Title 1.1',
                'children': [
                    { 'name': 'Title 1.1.1' },
                    { 'name': 'Title 1.1.2' },
                    { 'name': 'Title 1.1.3' }
                ]
            }, {
                'name': 'Title 1.2'
            }]
        }, {
            'name': 'Title 2'
        }])

    def test_article_with_no_titles(self):
        article = self.create_article('')
        self.assertEqual(article.get_toc(), [])

    def test_article_with_missing_titles(self):
        article = self.create_article('''
            <h1>Title 1</h1>
            <h3>Title 1.1.3</h3>
            <h2>Title 1.2</h2>
        ''')
        self.assertEqual(article.get_toc(), [{
            'name': 'Title 1',
            'children': [{
                'children': [
                    { 'name': 'Title 1.1.3' }
                ]
            }, {
                'name': 'Title 1.2'
            }]
        }])
