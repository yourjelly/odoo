# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.knowledge.tests.common import TestKnowledgeCommon
from odoo.tests.common import tagged


@tagged('access_rights', 'knowledge_tests', 'knowledge_article_publish')
class TestKnowledgeArticlePublish(TestKnowledgeCommon):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        Article = cls.env['knowledge.article'].with_user(cls.user_admin)
        cls.article_1 = Article.browse(Article.article_create('Article 1', private=True))
        cls.article_2 = Article.browse(Article.article_create('Article 2', private=True, parent_id=cls.article_1.id))

    def test_initial_tree(self):
        self.assertFalse(self.article_1.website_published)
        self.assertFalse(self.article_2.website_published)

    def test_article_publish(self):
        """Checking that the published articles are accessible to everyone."""
        self.assertEqual(self.article_1.with_user(self.user_demo).user_permission, 'none')
        self.assertFalse(self.article_1.with_user(self.user_demo).user_has_access)
        self.assertFalse(self.article_1.with_user(self.user_demo).user_can_write)
        self.assertEqual(self.article_2.with_user(self.user_demo).user_permission, 'none')
        self.assertFalse(self.article_2.with_user(self.user_demo).user_has_access)
        self.assertFalse(self.article_2.with_user(self.user_demo).user_can_write)
        self.assertEqual(self.article_1.with_user(self.user_admin).user_permission, 'write')
        self.assertTrue(self.article_1.with_user(self.user_admin).user_has_access)
        self.assertTrue(self.article_1.with_user(self.user_admin).user_can_write)
        self.assertEqual(self.article_2.with_user(self.user_admin).user_permission, 'write')
        self.assertTrue(self.article_2.with_user(self.user_admin).user_has_access)
        self.assertTrue(self.article_2.with_user(self.user_admin).user_can_write)
        self.assertEqual(self.article_1.with_user(self.user_portal).user_permission, 'none')
        self.assertFalse(self.article_1.with_user(self.user_portal).user_has_access)
        self.assertFalse(self.article_1.with_user(self.user_portal).user_can_write)
        self.assertEqual(self.article_2.with_user(self.user_portal).user_permission, 'none')
        self.assertFalse(self.article_2.with_user(self.user_portal).user_has_access)
        self.assertFalse(self.article_2.with_user(self.user_portal).user_can_write)

        self.article_1.write({
            'website_published': True
        })

        self.assertEqual(self.article_1.with_user(self.user_demo).user_permission, 'read')
        self.assertTrue(self.article_1.with_user(self.user_demo).user_has_access)
        self.assertFalse(self.article_1.with_user(self.user_demo).user_can_write)
        self.assertEqual(self.article_2.with_user(self.user_demo).user_permission, 'read')
        self.assertTrue(self.article_2.with_user(self.user_demo).user_has_access)
        self.assertFalse(self.article_2.with_user(self.user_demo).user_can_write)
        self.assertEqual(self.article_1.with_user(self.user_admin).user_permission, 'write')
        self.assertTrue(self.article_1.with_user(self.user_admin).user_has_access)
        self.assertTrue(self.article_1.with_user(self.user_admin).user_can_write)
        self.assertEqual(self.article_2.with_user(self.user_admin).user_permission, 'write')
        self.assertTrue(self.article_2.with_user(self.user_admin).user_has_access)
        self.assertTrue(self.article_2.with_user(self.user_admin).user_can_write)
        self.assertEqual(self.article_1.with_user(self.user_portal).user_permission, 'read')
        self.assertTrue(self.article_1.with_user(self.user_portal).user_has_access)
        self.assertFalse(self.article_1.with_user(self.user_portal).user_can_write)
        self.assertEqual(self.article_2.with_user(self.user_portal).user_permission, 'read')
        self.assertTrue(self.article_2.with_user(self.user_portal).user_has_access)
        self.assertFalse(self.article_2.with_user(self.user_portal).user_can_write)

        # Accessing the website

        self.authenticate(self.user_admin.login, self.user_admin.login)
        res = self.url_open(self.article_1.share_link)
        self.assertEqual(res.status_code, 200) # success
        self.logout()

        self.authenticate(self.user_demo.login, self.user_demo.login)
        res = self.url_open(self.article_1.share_link)
        self.assertEqual(res.status_code, 200) # success
        self.logout()

        self.authenticate(self.user_portal.login, self.user_portal.login)
        res = self.url_open(self.article_1.share_link)
        self.assertEqual(res.status_code, 200) # success
        self.logout()

        # child article

        self.authenticate(self.user_admin.login, self.user_admin.login)
        res = self.url_open(self.article_2.share_link)
        self.assertEqual(res.status_code, 200) # success
        self.logout()

        self.authenticate(self.user_demo.login, self.user_demo.login)
        res = self.url_open(self.article_2.share_link)
        self.assertEqual(res.status_code, 200) # success
        self.logout()

        self.authenticate(self.user_portal.login, self.user_portal.login)
        res = self.url_open(self.article_2.share_link)
        self.assertEqual(res.status_code, 200) # success
        self.logout()
