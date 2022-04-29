# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.knowledge.tests.common import TestKnowledgeCommon
from odoo.tests.common import tagged, new_test_user


@tagged('access_rights', 'knowledge_tests', 'knowledge_article')
class TestKnowledgeArticle(TestKnowledgeCommon):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        # private:
        # --------
        # - Article 1
        #     - Article 2
        #     - Article 3
        #         - Article 4
        #     - Article 5
        # - Article 6
        cls.user_demo_1 = new_test_user(cls.env, login='user_demo_1', email='user1.demo@example.com', groups='base.group_user')
        cls.user_demo_2 = new_test_user(cls.env, login='user_demo_2', email='user2.demo@example.com', groups='base.group_user')
        Article = cls.env['knowledge.article'].with_user(cls.user_demo_1)
        cls.article_1 = Article.browse(Article.article_create('Article 1', private=True))
        cls.article_2 = Article.browse(Article.article_create('Article 2', private=True, parent_id=cls.article_1.id))
        cls.article_3 = Article.browse(Article.article_create('Article 3', private=True, parent_id=cls.article_1.id))
        cls.article_4 = Article.browse(Article.article_create('Article 4', private=True, parent_id=cls.article_3.id))
        cls.article_5 = Article.browse(Article.article_create('Article 5', private=True, parent_id=cls.article_1.id))
        cls.article_6 = Article.browse(Article.article_create('Article 6', private=True))
        cls.article_2.action_toggle_favourite()
        cls.article_3.action_toggle_favourite()
        cls.article_4.action_toggle_favourite()

    def assertSortedSequence(self, articles):
        """
        Assert that the articles are properly sorted according to their sequence number
        :param articles (Model<knowledge.article>): Recordset of knowledge.article
        """
        for k in range(len(articles) - 1):
            self.assertTrue(articles[k].sequence <= articles[k + 1].sequence)

    def test_initial_tree(self):
        self.assertTrue(self.user_demo_1.mapped('partner_id.partner_share'))
        self.assertTrue(self.user_demo_2.mapped('partner_id.partner_share'))
        self.assertFalse(self.article_1.parent_id)
        self.assertEqual(self.article_2.parent_id, self.article_1)
        self.assertEqual(self.article_3.parent_id, self.article_1)
        self.assertEqual(self.article_4.parent_id, self.article_3)
        self.assertEqual(self.article_5.parent_id, self.article_1)
        self.assertFalse(self.article_6.parent_id)
        self.assertEqual(self.article_1.main_article_id, self.article_1)
        self.assertEqual(self.article_2.main_article_id, self.article_1)
        self.assertEqual(self.article_3.main_article_id, self.article_1)
        self.assertEqual(self.article_4.main_article_id, self.article_1)
        self.assertEqual(self.article_5.main_article_id, self.article_1)
        self.assertEqual(self.article_6.main_article_id, self.article_6)
        self.assertEqual(self.article_1.category, 'private')
        self.assertEqual(self.article_2.category, 'private')
        self.assertEqual(self.article_3.category, 'private')
        self.assertEqual(self.article_4.category, 'private')
        self.assertEqual(self.article_5.category, 'private')
        self.assertEqual(self.article_6.category, 'private')
        self.assertEqual(self.article_1.user_permission, 'write')
        self.assertEqual(self.article_2.user_permission, 'write')
        self.assertEqual(self.article_3.user_permission, 'write')
        self.assertEqual(self.article_4.user_permission, 'write')
        self.assertEqual(self.article_5.user_permission, 'write')
        self.assertEqual(self.article_6.user_permission, 'write')
        self.assertEqual(self.article_1.inherited_permission, 'none')
        self.assertEqual(self.article_2.inherited_permission, 'none')
        self.assertEqual(self.article_3.inherited_permission, 'none')
        self.assertEqual(self.article_4.inherited_permission, 'none')
        self.assertEqual(self.article_5.inherited_permission, 'none')
        self.assertEqual(self.article_6.inherited_permission, 'none')
        self.assertFalse(self.article_1.is_user_favourite)
        self.assertTrue(self.article_2.is_user_favourite)
        self.assertTrue(self.article_3.is_user_favourite)
        self.assertTrue(self.article_4.is_user_favourite)
        self.assertFalse(self.article_5.is_user_favourite)
        self.assertFalse(self.article_6.is_user_favourite)
        self.assertSortedSequence(self.article_1 + self.article_6)
        self.assertSortedSequence(self.article_2 + self.article_3 + self.article_5)

    def test_article_resequence(self):
        """Checking the sequence of the articles"""
        # move article_5 under article_2
        self.article_5.move_to(parent_id=self.article_1.id, before_article_id=self.article_2.id)
        # private:
        # --------
        # - Article 1
        #     - Article 2
        #     - Article 5
        #     - Article 3
        #         - Article 4
        # - Article 6
        self.assertFalse(self.article_1.parent_id)
        self.assertEqual(self.article_2.parent_id, self.article_1)
        self.assertEqual(self.article_3.parent_id, self.article_1)
        self.assertEqual(self.article_4.parent_id, self.article_3)
        self.assertEqual(self.article_5.parent_id, self.article_1)
        self.assertFalse(self.article_6.parent_id)
        self.assertSortedSequence(self.article_1 + self.article_6)
        self.assertSortedSequence(self.article_2 + self.article_5 + self.article_3)
        # move article_4 in first position under article_1
        self.article_4.move_to(parent_id=self.article_1.id, before_article_id=False)
        # private:
        # --------
        # - Article 1
        #     - Article 4
        #     - Article 2
        #     - Article 5
        #     - Article 3
        # - Article 6
        self.assertFalse(self.article_1.parent_id)
        self.assertEqual(self.article_2.parent_id, self.article_1)
        self.assertEqual(self.article_3.parent_id, self.article_1)
        self.assertEqual(self.article_4.parent_id, self.article_1)
        self.assertEqual(self.article_5.parent_id, self.article_1)
        self.assertFalse(self.article_6.parent_id)
        self.assertSortedSequence(self.article_1 + self.article_6)
        self.assertSortedSequence(self.article_4 + self.article_2 + self.article_5 + self.article_3)
