# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.knowledge.tests.common import TestKnowledgeCommon
from odoo.exceptions import AccessError
from odoo.tests.common import tagged


@tagged('access_rights', 'knowledge_tests', 'knowledge_article_access_control')
class TestKnowledgeArticleAccessControl(TestKnowledgeCommon):
    """This test suite will have to test the ACL and the record rules of the models."""
    def test_access_knowledge_admin(self):
        with self.with_user('user_admin'):
            # Create: all
            article_none = self.env['knowledge.article'].create({
                'name': 'Article',
                'internal_permission': 'none',
                'article_member_ids': [(0, 0, {
                    'partner_id': self.partner_demo.id,
                    'permission': 'write'
                })],
            })
            article_read_id = self.env['knowledge.article'].article_create("Child Article", article_none.id)
            article_read = self.env['knowledge.article'].browse(article_read_id)

            self.assertEqual(article_read.user_permission, 'write')
            self.assertTrue(article_read.user_can_write)
            self.assertTrue(article_read.user_has_access)
            self.assertEqual(article_none.user_permission, 'write')
            self.assertTrue(article_none.user_can_write)
            self.assertTrue(article_none.user_has_access)

            # Read: all
            # can see/write articles that have internal_permission="none"
            article_none.read(['body'])

            # Read: article favourites
            self.env['knowledge.article.favourite'].search([('article_id', '=', article_none.id)]).read(['sequence'])

            # Write: all
            article_none.write({'body': 'Hello world'})
            article_read.invite_members(self.partner_demo, 'write')
            article_read._set_internal_permission('read')
            # Write: article members
            article_none.invite_members(self.partner_admin, 'write')
            member = article_none.article_member_ids.filtered(lambda m: m.partner_id == self.partner_demo)
            article_none._remove_member(member.id)

            # Unlink: all
            article_none._set_internal_permission('write')
            article_none.unlink()

    def test_access_knowledge_user(self):
        article_none = self.env['knowledge.article'].create({
            'name': 'Article',
            'internal_permission': 'none',
            'article_member_ids': [(0, 0, {
                'partner_id': self.partner_admin.id,
                'permission': 'write'
            })],
        })
        article_none_2 = self.env['knowledge.article'].create({
            'name': 'Article',
            'internal_permission': 'write',
            'article_member_ids': [(0, 0, {
                'partner_id': self.partner_demo.id,
                'permission': 'none'
            })],
        })

        article_read = self.env['knowledge.article'].create({
            'name': 'Article Read',
            'internal_permission': 'read',
            'article_member_ids': [(0, 0, {
                'partner_id': self.partner_admin.id,
                'permission': 'write'
            })],
        })
        article_read_2 = self.env['knowledge.article'].create({
            'name': 'Article Read',
            'internal_permission': 'write',
            'article_member_ids': [(0, 0, {
                'partner_id': self.partner_demo.id,
                'permission': 'read'
            })],
        })

        with self.with_user('user_demo'):
            article_none = article_none.with_user(self.user_demo)
            article_none_2 = article_none_2.with_user(self.user_demo)
            article_read = article_read.with_user(self.user_demo)
            article_read_2 = article_read_2.with_user(self.user_demo)
            # Create: all
            article_private_id = self.env['knowledge.article'].article_create("My Article", private=True)
            article_private = self.env['knowledge.article'].browse(article_private_id)

            article_workspace_id = self.env['knowledge.article'].article_create("Workspace Article")
            article_workspace = self.env['knowledge.article'].browse(article_workspace_id)

            # Write: article where internal_permission="write" or where is member
            self.assertEqual(article_private.user_permission, 'write')
            self.assertTrue(article_private.user_can_write)
            self.assertEqual(article_workspace.user_permission, 'write')
            self.assertTrue(article_workspace.user_can_write)
            self.assertEqual(article_none.user_permission, 'none')
            self.assertFalse(article_none.user_can_write)
            self.assertEqual(article_none_2.user_permission, 'none')
            self.assertFalse(article_none_2.user_can_write)
            self.assertEqual(article_read.user_permission, 'read')
            self.assertFalse(article_read.user_can_write)
            self.assertEqual(article_read_2.user_permission, 'read')
            self.assertFalse(article_read_2.user_can_write)
            with self.assertRaises(AccessError, msg='base.group_user should not be allowed to write on article when the internal permission is set to "none"'):
                article_none.write({'body': 'Hello world'})
            with self.assertRaises(AccessError, msg='base.group_user should not be allowed to invite users on article when the internal permission is set to "none"'):
                article_none.invite_members(self.partner_demo, 'read')
            with self.assertRaises(AccessError, msg='base.group_user should not be allowed to write on article when the permission is set to "none"'):
                article_none_2.write({'body': 'Hello world'})
            with self.assertRaises(AccessError, msg='base.group_user should not be allowed to invite users on article when the permission is set to "none"'):
                article_none_2.invite_members(self.partner_demo, 'read')
            with self.assertRaises(AccessError, msg='base.group_user should not be allowed to write on articles when the internal permission is set to "read"'):
                article_read.write({'body': 'Hello world'})
            with self.assertRaises(AccessError, msg='base.group_user should not be allowed to invite users on articles when the internal permission is set to "read"'):
                article_read.invite_members(self.partner_demo, 'read')
            with self.assertRaises(AccessError, msg='base.group_user should not be allowed to write on articles when the permission is set to "read"'):
                article_read_2.write({'body': 'Hello world'})
            with self.assertRaises(AccessError, msg='base.group_user should not be allowed to invite users on articles when the permission is set to "read"'):
                article_read_2.invite_members(self.partner_demo, 'read')

            article_private.write({'body': 'Hello world'})
            article_private.invite_members(self.partner_admin, 'read')
            article_workspace.write({'body': 'Hello world'})
            article_workspace.invite_members(self.partner_admin, 'read')

            # Read: articles with internal_permission="read" or where is member with read permission
            self.assertTrue(article_private.user_has_access)
            self.assertTrue(article_workspace.user_has_access)
            self.assertFalse(article_none.user_has_access)
            self.assertFalse(article_none_2.user_has_access)
            self.assertTrue(article_read.user_has_access)
            self.assertTrue(article_read_2.user_has_access)
            article_read.read(['body'])
            with self.assertRaises(AccessError, msg='base.group_user should not be allowed to read on article when the internal permission is set to "none"'):
                article_none.read(['body'])
            with self.assertRaises(AccessError, msg='base.group_user should not be allowed to read on article when permission is set to "none"'):
                article_none_2.read(['body'])
            article_private.read(['body'])
            article_read_2.read(['body'])

            # Read: article favourites
            article_none.with_user(self.user_admin).action_toggle_favourite()
            not_visible = self.env['knowledge.article.favourite'].search([('article_id', '=', article_none.id)])
            self.assertFalse(not_visible)
            not_visible = self.env['knowledge.article.favourite'].search([('user_id', '=', self.user_admin.id)]).read(['sequence'])
            self.assertFalse(not_visible)
            article_read.action_toggle_favourite()
            visible = self.env['knowledge.article.favourite'].search([('article_id', '=', article_read.id)])
            self.assertEqual(len(visible), 1)

            # Write: article favourites
            self.env['knowledge.article.favourite'].search([('article_id', '=', article_read.id)]).write({'sequence': 1})

    def test_access_knowledge_portal(self):
        article_none = self.env['knowledge.article'].create({
            'name': 'Article',
            'internal_permission': 'none',
            'article_member_ids': [(0, 0, {
                'partner_id': self.partner_admin.id,
                'permission': 'write'
            })],
        })
        article_workspace_id = self.env['knowledge.article'].article_create("Workspace Article")
        article_workspace = self.env['knowledge.article'].browse(article_workspace_id)
        article_read_id = self.env['knowledge.article'].article_create("Read Article")
        article_read = self.env['knowledge.article'].browse(article_read_id)
        article_read.invite_members(self.partner_portal, 'read')

        with self.with_user('user_portal'):
            article_none = article_none.with_user(self.user_portal)
            article_workspace = article_workspace.with_user(self.user_portal)
            article_read = article_read.with_user(self.user_portal)
            # Create: none
            with self.assertRaises(AccessError, msg='user_portal should not be allowed to create articles'):
                self.env['knowledge.article'].article_create("My Article")
            with self.assertRaises(AccessError, msg='user_portal should not be allowed to create articles'):
                self.env['knowledge.article'].create({
                    'name': 'Article',
                    'internal_permission': 'none',
                    'article_member_ids': [(0, 0, {
                        'partner_id': self.partner_portal.id,
                        'permission': 'write'
                    })],
                })

            # Write: none
            self.assertFalse(article_none.user_can_write)
            self.assertFalse(article_workspace.user_can_write)
            self.assertFalse(article_read.user_can_write)
            with self.assertRaises(AccessError, msg='base.group_portal should not be allowed to write on any article'):
                article_none.write({'body': 'Hello world'})
            with self.assertRaises(AccessError, msg='base.group_portal should not be allowed to invite users on any article'):
                article_none.invite_members(self.partner_demo, 'read')
            with self.assertRaises(AccessError, msg='base.group_portal should not be allowed to write on any article'):
                article_read.write({'body': 'Hello world'})
            with self.assertRaises(AccessError, msg='base.group_portal should not be allowed to invite users on any article'):
                article_read.invite_members(self.partner_demo, 'read')
            with self.assertRaises(AccessError, msg='base.group_portal should not be allowed to write on any article'):
                article_workspace.write({'body': 'Hello world'})
            with self.assertRaises(AccessError, msg='base.group_portal should not be allowed to invite users on any article'):
                article_workspace.invite_members(self.partner_demo, 'read')

            # Read: articles with internal_permission="read" or where is member with read permission
            self.assertFalse(article_workspace.user_has_access)
            self.assertFalse(article_none.user_has_access)
            self.assertTrue(article_read.user_has_access)

            # right now, portal cannot read articles from the backend, but can read it from the frontend
            # article_read.read(['body'])
            with self.assertRaises(AccessError, msg='base.group_portal should not be allowed to read on article when the internal permission is set to "none"'):
                article_none.read(['body'])

            # Read: article favourites
            # add favourite for admin
            article_none.with_user(self.user_admin).action_toggle_favourite()
            not_visible = self.env['knowledge.article.favourite'].search([('article_id', '=', article_none.id)]).read(['sequence'])
            self.assertFalse(not_visible)
            not_visible = self.env['knowledge.article.favourite'].search([('user_id', '=', self.user_admin.id)]).read(['sequence'])
            self.assertFalse(not_visible)
            article_read.action_toggle_favourite()
            favourites = self.env['knowledge.article.favourite'].search([('article_id', '=', article_read.id)]).read(['sequence'])
            self.assertEqual(len(favourites), 1)

            # Write: article favourites
            self.env['knowledge.article.favourite'].search([('article_id', '=', article_read.id)]).write({'sequence': 1})
            article_workspace.with_user(self.user_admin).action_toggle_favourite()
            not_visible = self.env['knowledge.article.favourite'].search([('user_id', '=', self.user_admin.id)], limit=1)
            self.assertFalse(not_visible)

    def test_access_knowledge_public(self):
        article_workspace_id = self.env['knowledge.article'].article_create("Workspace Article")
        article_workspace = self.env['knowledge.article'].browse(article_workspace_id)

        with self.with_user('user_public'):
            article_workspace = article_workspace.with_user(self.user_public)
            # Create: none
            with self.assertRaises(AccessError, msg='user_public should not be allowed to create articles'):
                self.env['knowledge.article'].article_create("My Article")
            with self.assertRaises(AccessError, msg='user_public should not be allowed to create articles'):
                self.env['knowledge.article'].create({
                    'name': 'Article',
                    'internal_permission': 'none',
                    'article_member_ids': [(0, 0, {
                        'partner_id': self.partner_portal.id,
                        'permission': 'write'
                    })],
                })

            # Write: none
            with self.assertRaises(AccessError, msg='base.group_public should not be allowed to write on article'):
                article_workspace.write({'body': 'Hello world'})

            # Read: none
            with self.assertRaises(AccessError, msg='base.group_public should not be allowed to read on any article'):
                article_workspace.read({'body': 'Hello world'})

            # Read: article favourites
            with self.assertRaises(AccessError, msg='base.group_public should not be allowed to read on any article favourite'):
                self.env['knowledge.article.favourite'].search([('article_id', '=', article_workspace.id)]).read(['sequence'])
