# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import json

from odoo.addons.knowledge.tests.common import KnowledgeCommon
from odoo.exceptions import ValidationError
from odoo.tests.common import HttpCase, tagged, users


@tagged('knowledge_controller')
class KnowledgeArticleControllerTest(HttpCase, KnowledgeCommon):
    """ This test suit will have the responsibility to test the controller of Knowledge."""
    def fetch_permission_panel_data(self, article, user):
        """
        Fetches the permission panel data
        :param <knowledge.article> article: article
        :param <res.user> user: user
        """
        self.authenticate(user.login, user.login)
        params = {'article_id': article.id}
        res = self.url_open(
            '/knowledge/get_article_permission_panel_data',
            headers={"Content-Type": "application/json"},
            data=json.dumps({"params": params}).encode()
        )
        self.assertEqual(res.status_code, 200) # success
        self.logout()
        return res.json()['result']

    def assertIsSubDict(self, dictionary, sub_dictionary):
        """
        Assert true iff all key/value pairs of the sub-dictionary are in the dictionary.
        :param dict() dictionary: dictionary
        :param dict() sub_dictionary: dictionary
        """
        for key in sub_dictionary:
            if key not in dictionary:
                self.fail('The key %s is missing in the dictionnary' % key)
            if dictionary[key] != sub_dictionary[key]:
                self.fail('The dictionaries have different values for key "%s": %s != %s' % (
                    key,
                    dictionary[key],
                    sub_dictionary[key]
                ))

    @users('employee')
    def test_permission_panel_data(self):
        Article = self.env['knowledge.article']
        parent_article = Article.article_create(title='Parent article')
        child_article = Article.article_create(title='Child article', parent_id=parent_article.id)
        grandchild_article = Article.article_create(title='Grandchild article', parent_id=child_article.id)

        data = self.fetch_permission_panel_data(parent_article, self.user_employee)
        self.assertIsSubDict(data, {
            'internal_permission': 'write',
            'parent_permission': False,
            'based_on': False,
            'based_on_id': False,
            'members': [],
            'is_sync': True,
            'parent_id': False,
            'parent_name': False,
            'user_permission': 'write'
        })

        data = self.fetch_permission_panel_data(child_article, self.user_employee)
        self.assertIsSubDict(data, {
            'internal_permission': 'write',
            'parent_permission': 'write',
            'based_on': parent_article.display_name,
            'based_on_id': parent_article.id,
            'members': [],
            'is_sync': True,
            'parent_id': parent_article.id,
            'parent_name': parent_article.display_name,
            'user_permission': 'write'
        })

        data = self.fetch_permission_panel_data(grandchild_article, self.user_employee)
        self.assertIsSubDict(data, {
            'internal_permission': 'write',
            'parent_permission': 'write',
            'based_on': parent_article.display_name,
            'based_on_id': parent_article.id,
            'members': [],
            'is_sync': True,
            'parent_id': child_article.id,
            'parent_name': child_article.display_name,
            'user_permission': 'write'
        })

        # move the child article to the root of "workspace"

        child_article.move_to()
        # checking that the child article is disconnected from its parent.
        self.assertFalse(parent_article.parent_id)
        self.assertFalse(child_article.parent_id)
        self.assertEqual(grandchild_article.parent_id, child_article)
        self.assertFalse(parent_article.child_ids)
        self.assertEqual(child_article.child_ids, grandchild_article)
        self.assertFalse(grandchild_article.child_ids)
        # checking the category of each article
        self.assertEqual(parent_article.category, 'workspace')
        self.assertEqual(child_article.category, 'workspace')
        self.assertEqual(grandchild_article.category, 'workspace')

        data = self.fetch_permission_panel_data(parent_article, self.user_employee)
        self.assertIsSubDict(data, {
            'internal_permission': 'write',
            'parent_permission': False,
            'based_on': False,
            'based_on_id': False,
            'members': [],
            'is_sync': True,
            'parent_id': False,
            'parent_name': False,
            'user_permission': 'write'
        })

        data = self.fetch_permission_panel_data(child_article, self.user_employee)
        self.assertIsSubDict(data, {
            'internal_permission': 'write',
            'parent_permission': False,
            'based_on': False,
            'based_on_id': False,
            'members': [],
            'is_sync': True,
            'parent_id': False,
            'parent_name': False,
            'user_permission': 'write'
        })

        data = self.fetch_permission_panel_data(grandchild_article, self.user_employee)
        self.assertIsSubDict(data, {
            'internal_permission': 'write',
            'parent_permission': 'write',
            'based_on': child_article.display_name,
            'based_on_id': child_article.id,
            'members': [],
            'is_sync': True,
            'parent_id': child_article.id,
            'parent_name': child_article.display_name,
            'user_permission': 'write'
        })

    @users('employee')
    def test_restore_permissions(self):
        """ Check that the user can restore the of the article permissions. """
        parent_article = self.env['knowledge.article'].article_create(title='Parent article')
        child_article = self.env['knowledge.article'].article_create(title='Child article', parent_id=parent_article.id)
        parent_article.invite_members(self.partner_employee, 'write')
        self.assertTrue(len(parent_article.article_member_ids) == 1)

        data = self.fetch_permission_panel_data(parent_article, self.user_employee)
        self.assertIsSubDict(data, {
            'internal_permission': 'write',
            'parent_permission': False,
            'based_on': False,
            'based_on_id': False,
            'members': [{
                'id': parent_article.article_member_ids.id,
                'partner_id': self.partner_employee.id,
                'partner_name': self.partner_employee.name,
                'partner_email': self.partner_employee.email,
                'permission': 'write',
                'based_on': False,
                'based_on_id': False,
                'partner_share': False,
                'is_current_user': True,
                'is_unique_writer': False
            }],
            'is_sync': True,
            'parent_id': False,
            'parent_name': False,
            'user_permission': 'write'
        })

        data = self.fetch_permission_panel_data(child_article, self.user_employee)
        self.assertIsSubDict(data, {
            'internal_permission': 'write',
            'parent_permission': 'write',
            'based_on': parent_article.display_name,
            'based_on_id': parent_article.id,
            'members': [{
                'id': parent_article.article_member_ids.id,
                'partner_id': self.partner_employee.id,
                'partner_name': self.partner_employee.name,
                'partner_email': self.partner_employee.email,
                'permission': 'write',
                'based_on': parent_article.display_name,
                'based_on_id': parent_article.id,
                'partner_share': False,
                'is_current_user': True,
                'is_unique_writer': False
            }],
            'is_sync': True,
            'parent_id': parent_article.id,
            'parent_name': parent_article.display_name,
            'user_permission': 'write'
        })

        child_article._set_internal_permission('read')

        # After changing the internal permission of the child article, the child
        # article should be desync with its parent and the inherited members should
        # be copied.

        self.assertMembers(child_article, 'read', {
            self.partner_employee: 'write'
        })

        data = self.fetch_permission_panel_data(child_article, self.user_employee)
        self.assertIsSubDict(data, {
            'internal_permission': 'read',
            'parent_permission': 'write',
            'based_on': False,
            'based_on_id': False,
            'members': [{
                'id': child_article.article_member_ids.id,
                'partner_id': self.partner_employee.id,
                'partner_name': self.partner_employee.name,
                'partner_email': self.partner_employee.email,
                'permission': 'write',
                'based_on': False,
                'based_on_id': False,
                'partner_share': False,
                'is_current_user': True,
                'is_unique_writer': True
            }],
            'is_sync': False,
            'parent_id': parent_article.id,
            'parent_name': parent_article.display_name,
            'user_permission': 'write'
        })

        child_article.restore_article_access()

    @users('admin')
    def test_check_effectiveness_of_at_least_on_writter(self):
        """Checks that the constraints have not been applied."""
        parent_article = self.env['knowledge.article'].article_create(title='Parent article')
        child_article = self.env['knowledge.article'].article_create(title='Child article')
        child_article.move_to(parent_id=parent_article.id)
        self.assertEqual(child_article.parent_id, parent_article)

        parent_article.invite_members(self.partner_admin, 'write')
        parent_article.invite_members(self.partner_employee, 'read')

        self.assertMembers(child_article, 'write', {})
        self.assertMembers(parent_article, 'write', {
            self.partner_admin: 'write',
            self.partner_employee: 'read'
        })

        member = parent_article.article_member_ids.filtered(lambda member: member.partner_id == self.partner_employee)
        self.assertTrue(len(member) == 1)
        child_article._set_member_permission(member, 'write', True)

        self.assertMembers(child_article, 'write', {
            self.partner_employee: 'write'
        })
        self.assertMembers(parent_article, 'write', {
            self.partner_admin: 'write',
            self.partner_employee: 'read'
        })

        child_article._set_internal_permission('read')

        self.assertMembers(child_article, 'read', {
            self.partner_admin: 'write',
            self.partner_employee: 'write'
        })
        self.assertMembers(parent_article, 'write', {
            self.partner_admin: 'write',
            self.partner_employee: 'read'
        })

        child_article._remove_member(
            child_article.article_member_ids.filtered(lambda member:
                member.partner_id == self.partner_employee
            )
        )
        self.assertMembers(child_article, 'read', {self.partner_admin: 'write'})
        self.assertMembers(parent_article, 'write', {
            self.partner_admin: 'write',
            self.partner_employee: 'read'
        })

        with self.assertRaises(ValidationError):
            child_article._remove_member(
                child_article.article_member_ids.filtered(lambda member:
                    member.partner_id == self.partner_admin
                )
            )

        self.assertMembers(child_article, 'read', {
            self.partner_admin: 'write'
        })
        self.assertMembers(parent_article, 'write', {
            self.partner_admin: 'write',
            self.partner_employee: 'read'
        })
