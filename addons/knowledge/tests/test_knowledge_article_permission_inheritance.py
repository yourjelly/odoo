# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.knowledge.tests.common import TestKnowledgeCommon
from odoo.tests.common import tagged, new_test_user


@tagged('access_rights', 'knowledge_tests', 'knowledge_article_permission_inheritance')
class TestKnowledgeArticlePermissionInheritance(TestKnowledgeCommon):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        # private:
        # --------
        # - Article 1
        #     - Article 2
        #         - Article 3
        #         - Article 4
        cls.user_demo_1 = new_test_user(cls.env, login='user_demo_1', email='user1.demo@example.com', groups='base.group_user')
        cls.user_demo_2 = new_test_user(cls.env, login='user_demo_2', email='user2.demo@example.com', groups='base.group_user')
        Article = cls.env['knowledge.article'].with_user(cls.user_demo_1)
        cls.article_1 = Article.browse(Article.article_create('Article 1', private=False))
        cls.article_2 = Article.browse(Article.article_create('Article 2', private=False, parent_id=cls.article_1.id))
        cls.article_3 = Article.browse(Article.article_create('Article 3', private=False, parent_id=cls.article_2.id))
        cls.article_4 = Article.browse(Article.article_create('Article 4', private=False, parent_id=cls.article_2.id))

    def test_initial_tree(self):
        self.assertTrue(self.user_demo_1.partner_id)
        self.assertTrue(self.user_demo_2.partner_id)
        self.assertEqual(self.article_1.internal_permission, 'write')
        self.assertEqual(self.article_1.inherited_permission, 'write')
        self.assertEqual(self.article_2.inherited_permission, 'write')
        self.assertEqual(self.article_3.inherited_permission, 'write')
        self.assertEqual(self.article_4.inherited_permission, 'write')
        self.assertFalse(self.article_1.is_desynchronized)
        self.assertFalse(self.article_2.is_desynchronized)
        self.assertFalse(self.article_3.is_desynchronized)
        self.assertFalse(self.article_4.is_desynchronized)
        self.assertFalse(self.article_1.mapped('article_member_ids.partner_id'))
        self.assertFalse(self.article_2.mapped('article_member_ids.partner_id'))
        self.assertFalse(self.article_3.mapped('article_member_ids.partner_id'))
        self.assertFalse(self.article_4.mapped('article_member_ids.partner_id'))

    def test_desync_when_downgrading_internal_permission_to_read(self):
        self.article_2.with_user(self.user_admin)._set_internal_permission('read')
        self.assertEqual(self.article_1.internal_permission, 'write')
        self.assertEqual(self.article_2.internal_permission, 'read')
        self.assertEqual(self.article_1.inherited_permission, 'write')
        self.assertEqual(self.article_2.inherited_permission, 'read')
        self.assertEqual(self.article_3.inherited_permission, 'read')
        self.assertEqual(self.article_4.inherited_permission, 'read')
        self.assertFalse(self.article_1.is_desynchronized)
        self.assertTrue(self.article_2.is_desynchronized)
        self.assertFalse(self.article_3.is_desynchronized)
        self.assertFalse(self.article_4.is_desynchronized)
        # always add current user as writer if user sets article permission != write
        self.assertFalse(self.article_1.mapped('article_member_ids.partner_id'))
        self.assertEqual(self.article_2.mapped('article_member_ids.partner_id'), self.partner_admin)
        self.assertFalse(self.article_3.mapped('article_member_ids.partner_id'))
        self.assertFalse(self.article_4.mapped('article_member_ids.partner_id'))

    def test_desync_when_downgrading_internal_permission_to_none(self):
        self.article_2.with_user(self.user_admin)._set_internal_permission('none')
        self.assertEqual(self.article_1.internal_permission, 'write')
        self.assertEqual(self.article_2.internal_permission, 'none')
        self.assertEqual(self.article_1.inherited_permission, 'write')
        self.assertEqual(self.article_2.inherited_permission, 'none')
        self.assertEqual(self.article_3.inherited_permission, 'none')
        self.assertEqual(self.article_4.inherited_permission, 'none')
        self.assertFalse(self.article_1.is_desynchronized)
        self.assertTrue(self.article_2.is_desynchronized)
        self.assertFalse(self.article_3.is_desynchronized)
        self.assertFalse(self.article_4.is_desynchronized)
        # always add current user as writer if user sets article permission != write
        self.assertFalse(self.article_1.mapped('article_member_ids.partner_id'))
        self.assertEqual(self.article_2.mapped('article_member_ids.partner_id'), self.partner_admin)
        self.assertFalse(self.article_3.mapped('article_member_ids.partner_id'))
        self.assertFalse(self.article_4.mapped('article_member_ids.partner_id'))
