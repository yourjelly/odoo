# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import exceptions
from odoo.addons.knowledge.tests.common import KnowledgeCommon
from odoo.tests.common import tagged, users
from odoo.tools import mute_logger


@tagged('knowledge_acl')
class TestKnowledgeSecurity(KnowledgeCommon):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        with mute_logger('odoo.models.unlink'):
            cls.env['knowledge.article'].search([]).unlink()

        cls.article_root_sudo = cls.env['knowledge.article'].sudo().create({
            'article_member_ids': [(0, 0, {
                'partner_id': cls.partner_admin.id,
                'permission': 'write',
            })],
            'internal_permission': 'read',
            'name': 'Article Library',
        })
        cls.article_hidden_sudo = cls.env['knowledge.article'].sudo().create({
            'article_member_ids': [
                (0, 0, {'partner_id': cls.partner_admin.id,
                        'permission': 'write',}),
            ],
            'internal_permission': 'none',
            'favorite_ids': [(0, 0, {'user_id': cls.user_admin.id})],
            'name': 'Hidden Article',
        })
        cls.article_shared_sudo = cls.env['knowledge.article'].sudo().create({
            'article_member_ids': [
                (0, 0, {'partner_id': cls.partner_admin.id,
                        'permission': 'write',}),
                (0, 0, {'partner_id': cls.partner_employee.id,
                        'permission': 'read',}),
                (0, 0, {'partner_id': cls.partner_portal.id,
                        'permission': 'read',}),
            ],
            'internal_permission': 'none',
            'favorite_ids': [(0, 0, {'user_id': cls.user_admin.id}),
                             (0, 0, {'user_id': cls.user_employee.id})
            ],
            'name': 'Shared Article',
        })

    @mute_logger('odoo.addons.base.models.ir_model', 'odoo.addons.base.models.ir_rule')
    @users('portal_test')
    def test_models_as_portal(self):
        article_root = self.article_root_sudo.with_env(self.env)

        # ARTICLES
        with self.assertRaises(exceptions.AccessError,
                               msg='No access given to portal'):
            article_root.body  # access body should trigger acls

        article_hidden = self.article_hidden_sudo.with_env(self.env)
        with self.assertRaises(exceptions.AccessError,
                               msg='None access, not for portal'):
            article_hidden.body  # access body should trigger acls

        # FAVORITES
        self.assertFalse(self.env['knowledge.article.favorite'].search([]))
        favorites = self.article_shared_sudo.favorite_ids.with_env(self.env)
        with self.assertRaises(exceptions.AccessError,
                               msg='Breaking rule for portal'):
            favorites.mapped('user_id')  # access body should trigger acls

        # MEMBERS
        with self.assertRaises(exceptions.AccessError,
                               msg='No ACLs for portal'):
            self.assertFalse(self.env['knowledge.article.member'].search([]))
        members = self.article_shared_sudo.article_member_ids.with_env(self.env)
        with self.assertRaises(exceptions.AccessError,
                               msg='Breaking rule for portal'):
            members.mapped('partner_id')  # access body should trigger acls


    @mute_logger('odoo.addons.base.models.ir_model', 'odoo.addons.base.models.ir_rule')
    @users('employee')
    def test_models_as_user(self):
        article_root = self.article_root_sudo.with_env(self.env)
        self.assertTrue(article_root.user_has_access)
        self.assertFalse(article_root.user_can_write)

        # ARTICLES
        article_root.body  # access body should trigger acls
        with self.assertRaises(exceptions.AccessError,
                               msg='Read access only'):
            article_root.write({'name': 'Hacked'})

        article_hidden = self.article_hidden_sudo.with_env(self.env)
        with self.assertRaises(exceptions.AccessError,
                               msg='None access, not for user'):
            article_hidden.body  # access body should trigger acls

        # FAVORITES
        my_favs = self.env['knowledge.article.favorite'].search([])
        self.assertEqual(
            my_favs,
            self.article_shared_sudo.favorite_ids.filtered(lambda f: f.user_id == self.env.user),
            'Favorites: employee should see its own favorites'
        )
        my_favs.mapped('user_id')  # access body should trigger acls
        my_favs.write({'sequence': 0})
        # TDE FIXME
        # with self.assertRaises(exceptions.AccessError,
        #                        msg='Should not be used to change article/user'):
        #     my_favs.write({'article_id': self.article_hidden_sudo.id})
        # with self.assertRaises(exceptions.AccessError,
        #                        msg='Should not be used to change article/user'):
        #     my_favs.write({'user_id': self.user_portal.id})

        # MEMBERS
        my_members = self.env['knowledge.article.member'].search([])
        self.assertEqual(
            my_members,
            (self.article_shared_sudo + self.article_root_sudo).article_member_ids,
            'Members: employee should see its own memberships'
        )
        my_members.mapped('partner_id')  # access body should trigger acls
        with self.assertRaises(exceptions.AccessError,
                               msg='No ACLs for write for user'):
            my_members.write({'permission': 'write'})

    @mute_logger('odoo.models.unlink')
    @users('admin')
    def test_models_as_system(self):
        self.assertTrue(self.env.user.has_group('base.group_system'))

        article_root = self.article_root_sudo.with_env(self.env)
        article_root.body  # access body should trigger acls
        article_hidden = self.article_hidden_sudo.with_env(self.env)
        article_hidden.body  # access body should trigger acls

        # ARTICLE: CREATE/READ
        # create a private article for another user
        other_private = self.env['knowledge.article'].create({
            'article_member_ids': [(0, 0, {
                'partner_id': self.partner_employee.id,
                'permission': 'write',
            })],
            'internal_permission': 'none',
            'name': 'Private for Employee',
        })
        self.assertEqual(other_private.article_member_ids.partner_id, self.partner_employee)
        self.assertEqual(other_private.category, 'private')
        self.assertEqual(other_private.owner_id, self.user_employee)

        # create a child to it
        other_private_child = self.env['knowledge.article'].create({
            'name': 'Child of Private for Employee',
            'parent_id': other_private.id,
        })
        self.assertEqual(other_private_child.article_member_ids.partner_id, self.env['res.partner'])
        self.assertEqual(other_private_child.category, 'private')
        self.assertEqual(other_private_child.owner_id, self.user_employee)

        # ARTICLE: WRITE
        other_private.write({'name': 'Can Update'})
        other_private_child.write({'name': 'Can Also Update'})

        # FAVORITES: CREATE/READ/UNLINK
        other_private_child.action_toggle_favorite()
        self.assertTrue(other_private_child.is_user_favorite)
        favorite_rec = self.env['knowledge.article.favorite'].search([('article_id', '=', other_private_child.id)])
        favorite_rec.unlink()
        self.assertFalse(other_private_child.is_user_favorite)

        # MEMBERS: CREATE/READ/UNLINK
        members = other_private.article_member_ids
        self.assertEqual(members.partner_id, self.partner_employee)
        new_member = self.env['knowledge.article.member'].create({
            'article_id': other_private.id,
            'partner_id': self.partner_employee2.id,
            'permission': 'read',
        })
        members = other_private.article_member_ids
        self.assertEqual(members.partner_id, self.partner_employee + self.partner_employee2)
        new_member.write({'permission': 'write'})
        members.filtered(lambda m: m.partner_id == self.partner_employee).unlink()
        members = other_private.article_member_ids
        self.assertEqual(members, new_member)
        self.assertEqual(members.partner_id, self.partner_employee2)
