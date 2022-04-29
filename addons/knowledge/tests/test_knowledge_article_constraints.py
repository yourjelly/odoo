# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from psycopg2 import IntegrityError

from odoo.addons.knowledge.tests.common import TestKnowledgeCommon
from odoo.exceptions import AccessError, ValidationError
from odoo.tests.common import tagged
from odoo.tools import mute_logger


@tagged('access_rights', 'knowledge_tests', 'knowledge_article_constraints')
class TestKnowledgeConstraints(TestKnowledgeCommon):
    """
    This test suite will have the responsibility to test the different constraints
    defined on the `knowledge.article` and `knowledge.article.member` and
    `knowledge.article.favourite` models.
    """
    def test_article_acyclic_graph(self):
        """Checking that the article hierarchy does not contain cycles"""
        Article = self.env['knowledge.article'].with_user(self.user_demo)
        article_1 = Article.browse(Article.article_create('Article 1', private=True))
        article_2 = Article.browse(Article.article_create('Article 2', private=True, parent_id=article_1.id))
        article_3 = Article.browse(Article.article_create('Article 3', private=True, parent_id=article_2.id))
        # move the parent article under one of its children should raise an exception
        with self.assertRaises(ValidationError, msg='The article hierarchy contains a cycle'):
            article_1.move_to(parent_id=article_3.id)
        with self.assertRaises(ValidationError, msg='The article hierarchy contains a cycle'):
            article_1.write({
                'parent_id': article_3.id
            })

    def test_article_should_have_at_least_one_member(self):
        """Checking that an article has at least one member."""
        Article = self.env['knowledge.article'].with_user(self.user_admin)
        with self.assertRaises(ValidationError, msg='Article should have at least one writer'):
            Article.create({
                'name': 'Article',
                'internal_permission': 'none',
            })
        with self.assertRaises(ValidationError, msg='Article should have at least one writer'):
            Article.create({
                'name': 'Article',
                'internal_permission': 'read',
            })
        article = Article.create({
            'name': 'Article',
            'internal_permission': 'none',
            'article_member_ids': [(0, 0, {
                'partner_id': self.partner_demo.id,
                'permission': 'write'
            })]
        })
        self.assertEqual(article.category, 'private')
        with self.assertRaises(ValidationError, msg='Cannot remove the last writer on an article'):
            member = article.article_member_ids.filtered(lambda m: m.partner_id == self.partner_demo)
            self.assertTrue(member)
            article._remove_member(member.id)
        with self.assertRaises(ValidationError, msg='Cannot remove the last writer on an article'):
            member = article.article_member_ids.filtered(lambda m: m.partner_id == self.partner_demo)
            self.assertTrue(member)
            article._set_member_permission(member.id, 'none')
        with self.assertRaises(ValidationError, msg='Cannot remove the last writer on an article'):
            article.write({
                'article_member_ids': self.env['knowledge.article.member']
            })

    @mute_logger('odoo.sql_db')
    def test_unique_favourite(self):
        """Checking that there is at most one 'knowledge.article.favourite' entry per article and user"""
        Article = self.env['knowledge.article'].with_user(self.user_demo)
        article = Article.browse(Article.article_create('Article', private=True))
        with self.assertRaises(IntegrityError, msg='There exists multiple user favourite entries'):
            article.write({'favourite_user_ids': [
                (0, 0, {
                    'user_id': self.user_demo.id,
                }),
                (0, 0, {
                    'user_id': self.user_demo.id
                })
            ]})

    @mute_logger('odoo.sql_db')
    def test_unique_member(self):
        """Checking that there will be no duplicated members in the member list."""
        Article = self.env['knowledge.article'].with_user(self.user_admin)
        article = Article.browse(Article.article_create('Article', private=True))
        with self.assertRaises(IntegrityError, msg='There exists multiple members with the same user id'):
            article.invite_members(self.partner_demo + self.partner_demo, 'write')
        with self.assertRaises(IntegrityError, msg='There exists multiple members with the same user id'):
            article.write({'article_member_ids': [
                (0, 0, {
                    'partner_id': self.partner_demo.id,
                    'permission': 'write'
                }),
                (0, 0, {
                    'partner_id': self.partner_demo.id,
                    'permission': 'write'
                })
            ]})

    @mute_logger('odoo.sql_db')
    def test_mandatory_internal_permission_for_root_article(self):
        """Checking that the root article has internal permission set."""
        Article = self.env['knowledge.article'].with_user(self.user_demo)
        with self.assertRaises(IntegrityError, msg='An internal permission should be set for root article'):
            Article.create({
                'name': 'Article',
                'article_member_ids': [(0, 0, {
                    'partner_id': self.partner_demo.id,
                    'permission': 'write'
                })]
            })

    def test_external_partner_permission_restriction(self):
        """Checking that the external partner can not have 'write' access."""
        Article = self.env['knowledge.article'].with_user(self.user_demo)
        article = Article.browse(Article.article_create('Article', private=True))
        partner = self.env['res.partner'].create({
            'name': 'John Doe',
            'email': 'john.doe@example.com'
        })
        # check that the partner is external
        self.assertTrue(partner.partner_share)
        # check that an external partner can not have "write" permission
        with self.assertRaises(ValidationError, msg='An external partner can not have "write" permission on an article'):
            article.write({
                'article_member_ids': [(0, 0, {
                    'partner_id': partner.id,
                    'permission': 'write'
                })]
            })
        article.invite_members(partner, 'write')
        # check that the permission has been set to "read" instead of "write"
        member = article.article_member_ids.filtered(lambda m: m.partner_id == partner)
        self.assertEqual(member.mapped('permission'), ['read'])

    def test_article_creation_constraints(self):
        """Checking the article creation constraints"""
        Article = self.env['knowledge.article'].with_user(self.user_admin)
        article = Article.browse(Article.article_create(private=False))

        # The user should not be allowed to create a private article under a non-private article
        self.assertTrue(article.category, 'workspace')
        with self.assertRaises(ValidationError):
            Article.article_create(private=True, parent_id=article.id)

        # The user should not be allowed to create an article under an article without "write" permission
        article.invite_members(self.partner_demo, 'none')
        self.assertTrue(article.category, 'workspace')
        self.assertFalse(article.with_user(self.user_demo).user_can_write)
        with self.assertRaises(AccessError):
            Article.with_user(self.user_demo).article_create(private=False, parent_id=article.id)

        # The user should not be allowed to create a private article under a non-owned article
        member = article.article_member_ids.filtered(lambda m: m.partner_id == self.partner_demo)
        article._remove_member(member.id)
        article.move_to(private=True)
        self.assertEqual(article.mapped('article_member_ids.partner_id'), self.partner_admin)
        self.assertTrue(article.category, 'private')
        self.assertFalse(article.owner_id == self.user_demo)
        with self.assertRaises(AccessError):
            Article.with_user(self.user_demo).article_create(private=False, parent_id=article.id)
