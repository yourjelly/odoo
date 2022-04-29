# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.knowledge.tests.common import TestKnowledgeCommon
from odoo.tests.common import tagged


@tagged('access_rights', 'knowledge_tests', 'knowledge_controllers')
class TestKnowledgeControllers(TestKnowledgeCommon):
    """This test suite will have the responsibility to test the controller of
    the knowledge module."""

    def test_article_toggle_favourite(self):
        """Checking that the user can add an article to their favourites."""
        Article = self.env['knowledge.article'].with_user(self.user_demo)
        article = Article.browse(Article.article_create('Article', private=False))
        url = article.get_base_url() + '/article/toggle_favourite'

        self.assertFalse(article.with_user(self.user_demo).is_user_favourite)
        self.assertFalse(article.with_user(self.user_admin).is_user_favourite)

        # user_demo adds the article to their favourites
        self.authenticate(self.user_demo.login, self.user_demo.login)
        res = self.opener.post(url=url, json={
            'params': {'article_id': article.id}
        })
        self.assertEqual(res.status_code, 200) # success
        self.assertTrue(article.with_user(self.user_demo).is_user_favourite)
        self.assertFalse(article.with_user(self.user_admin).is_user_favourite)
        self.logout()

        # user_admin adds the article to their favourites
        self.authenticate(self.user_admin.login, self.user_admin.login)
        res = self.opener.post(url=url, json={
            'params': {'article_id': article.id}
        })
        self.assertEqual(res.status_code, 200) # success
        self.assertTrue(article.with_user(self.user_demo).is_user_favourite)
        self.assertTrue(article.with_user(self.user_admin).is_user_favourite)
        self.logout()
