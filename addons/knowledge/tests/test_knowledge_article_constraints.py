# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from psycopg2 import IntegrityError

from odoo import exceptions
from odoo.addons.knowledge.tests.common import KnowledgeCommon
from odoo.tests.common import tagged, users
from odoo.tools import mute_logger


@tagged('knowledge_internals')
class TestKnowledgeArticleConstraints(KnowledgeCommon):
    """ This test suite has the responsibility to test the different constraints
    defined on the `knowledge.article` and `knowledge.article.member` and
    `knowledge.article.favourite` models. """

    @users('employee')
    def test_article_acyclic_graph(self):
        """ Check that the article hierarchy does not contain cycles. """
        article = self.env['knowledge.article'].create([
            {'internal_permission': 'write',
             'name': 'Header',
             'sequence': 0,
            }
        ])
        article_childs = self.env['knowledge.article'].create([
            {'name': 'Child1',
             'parent_id': article.id,
             'sequence': 1,
            },
            {'name': 'Child2',
             'parent_id': article.id,
             'sequence': 2,
            }
        ])

        # move the parent article under one of its children should raise an exception
        with self.assertRaises(exceptions.ValidationError, msg='The article hierarchy contains a cycle'):
            article.move_to(parent_id=article_childs[1].id)
        with self.assertRaises(exceptions.ValidationError, msg='The article hierarchy contains a cycle'):
            article.write({
                'parent_id': article_childs[1].id
            })

    @mute_logger('odoo.addons.base.models.ir_rule')
    @users('employee')
    def test_article_creation_constraints(self):
        """ Checking the article creation constraints. """
        article = self.env['knowledge.article'].create({
            'internal_permission': 'write',
            'name': 'Article',
        })
        self.assertTrue(article.category, 'workspace')
        self.assertTrue(article.user_has_access)
        self.assertTrue(article.user_can_write)

        # Even admins should not be allowed to create a private article under a non-private article
        # with self.assertRaises(exceptions.ValidationError):
        #     self.env['knowledge.article'].sudo().create({
        #         'article_member_ids': [(0, 0, {'partner_id': self.user_admin.id, 'permission': 'write'})],
        #         'name': 'Private Child',
        #         'parent_id': article.id,
        #     })

        # Member should not be allowed to create an article under an article without "write" permission
        article.invite_members(self.partner_employee2, 'read')
        self.assertTrue(article.category, 'workspace')
        self.assertFalse(article.with_user(self.user_employee2).user_can_write)
        self.assertTrue(article.with_user(self.user_employee2).user_has_access)
        with self.assertRaises(exceptions.AccessError):
            self.env['knowledge.article'].with_user(self.user_employee2).create({
                'name': 'My Own',
                'parent_id': article.id,
            })

        # Member should not be allowed to create a private article under a non-owned article
        article_private = self._create_private_article('MyPrivate')
        self.assertEqual(article_private.article_member_ids.partner_id, self.partner_employee)
        self.assertTrue(article_private.category, 'private')
        self.assertEqual(article_private.owner_id, self.env.user)
        with self.assertRaises(exceptions.AccessError):
            self.env['knowledge.article'].with_user(self.user_employee2).create({
                'name': 'My Own Private',
                'parent_id': article.id,
            })

    @mute_logger('odoo.sql_db')
    @users('employee')
    def test_article_root_internal_permission(self):
        """Check that the root article has internal permission set."""
        # defaulting to write permission if nothing is given
        article = self.env['knowledge.article'].create({
            'name': 'Article',
            'parent_id': False,
        })
        self.assertEqual(article.category, 'workspace')
        self.assertEqual(article.internal_permission, 'write')

        # ensure a member has write access before trying to remove global access
        # and allow raising the IntegrityError (otherwise a ValidationError raises)
        article.sudo().write({
            'article_member_ids': [(0, 0, {'partner_id': self.env.user.partner_id.id,
                                           'permission': 'write'})],
        })

        with self.assertRaises(IntegrityError, msg='An internal permission should be set for root article'):
            with self.cr.savepoint():
                article.write({'internal_permission': False})

        article_child = self.env['knowledge.article'].create({
            'name': 'Article',
            'parent_id': article.id,
        })
        self.assertEqual(article_child.category, 'workspace')
        self.assertFalse(article_child.internal_permission)
        self.assertEqual(article_child.main_article_id, article)
        with self.assertRaises(IntegrityError, msg='An internal permission should be set for root article'):
            with self.cr.savepoint():
                article_child.sudo().write({'parent_id': False})

    @users('employee')
    def test_article_should_have_at_least_one_writer(self):
        """ Check that an article has at least one writer."""
        with self.assertRaises(exceptions.ValidationError, msg='Article should have at least one writer'):
            self.env['knowledge.article'].create({
                'name': 'Article',
                'internal_permission': 'none',
            })
        with self.assertRaises(exceptions.ValidationError, msg='Article should have at least one writer'):
            self.env['knowledge.article'].create({
                'name': 'Article',
                'internal_permission': 'read',
            })

        article_private = self._create_private_article('MyPrivate')
        self.assertEqual(article_private.article_member_ids.partner_id, self.env.user.partner_id)
        self.assertEqual(article_private.category, 'private')

        # take membership as sudo to really have access to unlink feature
        membership_sudo = article_private.sudo().article_member_ids
        self.assertEqual(membership_sudo.partner_id, self.env.user.partner_id)

        # cannot remove last writer
        with self.assertRaises(exceptions.ValidationError, msg='Cannot remove the last writer on an article'):
            membership_sudo.unlink()
        with self.assertRaises(exceptions.ValidationError, msg='Cannot remove the last writer on an article'):
            article_private.sudo()._remove_member(membership_sudo.id)
        with self.assertRaises(exceptions.ValidationError, msg='Cannot remove the last writer on an article'):
            article_private.sudo().write({
                'article_member_ids': self.env['knowledge.article.member']
            })

        # cannot transform last writer into rejected
        with self.assertRaises(exceptions.ValidationError, msg='Cannot remove the last writer on an article'):
            article_private.sudo().write({
                'article_member_ids': [(1, membership_sudo.id, {'permission': 'none'})]
            })
        with self.assertRaises(exceptions.ValidationError, msg='Cannot remove the last writer on an article'):
            article_private._set_member_permission(membership_sudo.id, 'none')

    @mute_logger('odoo.sql_db')
    @users('employee')
    def test_favourite_uniqueness(self):
        """ Check there is at most one 'knowledge.article.favourite' entry per
        article and user. """
        article = self.env['knowledge.article'].create(
            {'internal_permission': 'write',
             'name': 'Article'}
        )
        self.assertFalse(article.is_user_favorite)
        article.write({'favorite_ids': [(0, 0, {'user_id': self.env.user.id})]})
        self.assertTrue(article.is_user_favorite)
        with self.assertRaises(IntegrityError,
                               msg='Multiple favorite entries are not accepted'):
            article.write({'favorite_ids': [(0, 0, {'user_id': self.env.user.id})]})
        self.assertTrue(article.is_user_favorite)

    @users('employee')
    def test_member_share_restrictions(self):
        """Checking that the external partner can not have 'write' access."""
        article = self._create_private_article('MyPrivate')
        self.assertEqual(article.category, 'private')

        customer = self.customer.with_env(self.env)
        self.assertTrue(customer.partner_share)

        # check that an external partner can not have "write" permission
        with self.assertRaises(exceptions.ValidationError,
                               msg='An external partner can not have "write" permission on an article'):
            article.sudo().write({
                'article_member_ids': [(0, 0, {
                    'partner_id': customer.id,
                    'permission': 'write'
                })]
            })
        article.invite_members(customer, 'write', send_mail=False)
        # check that the permission has been set to "read" instead of "write"
        member = article.article_member_ids.filtered(lambda m: m.partner_id == customer)
        self.assertEqual(member.mapped('permission'), ['read'])

    @mute_logger('odoo.sql_db')
    @users('employee')
    def test_member_uniqueness(self):
        """Check that there are no duplicated members in the member list. """
        article = self.env['knowledge.article'].create({
            'internal_permission': 'write',
            'name': 'Article',
        })
        article.sudo().write({
            'article_member_ids': [(0, 0, {'partner_id': self.env.user.partner_id.id,
                                           'permission': 'write'})]
        })
        self.assertEqual(len(self.env['knowledge.article.member'].sudo().search([('article_id', '=', article.id)])), 1)

        # adding a duplicate
        with self.assertRaises(IntegrityError,
                               msg='Members should be unique (article_id/partner_id)'):
            article.sudo().write({
                'article_member_ids': [(0, 0, {'partner_id': self.env.user.partner_id.id,
                                               'permission': 'write'})]
            })
        self.assertEqual(len(self.env['knowledge.article.member'].sudo().search([('article_id', '=', article.id)])), 1)

        # trying with tool method
        article.invite_members(self.env.user.partner_id, 'write')
        self.assertEqual(len(self.env['knowledge.article.member'].sudo().search([('article_id', '=', article.id)])), 1)

        # creating duplicates
        with self.assertRaises(IntegrityError,
                               msg='Members should be unique (article_id/partner_id)'):
            article.invite_members(self.partner_employee2 + self.partner_employee2, 'write')
        self.assertEqual(len(self.env['knowledge.article.member'].sudo().search([('article_id', '=', article.id)])), 1)

        with self.assertRaises(IntegrityError,
                               msg='Members should be unique (article_id/partner_id)'):
            article.sudo().write({
                'article_member_ids': [(0, 0, {'partner_id': self.partner_admin.id,
                                               'permission': 'write'}),
                                       (0, 0, {'partner_id': self.partner_admin.id,
                                               'permission': 'write'})
                                      ],
            })
        self.assertEqual(len(self.env['knowledge.article.member'].sudo().search([('article_id', '=', article.id)])), 1)
