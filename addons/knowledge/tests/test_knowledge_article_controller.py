# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import json

from odoo.addons.knowledge.tests.common import KnowledgeCommon
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
