# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.knowledge.tests.common import TestKnowledgeCommon
from odoo.exceptions import AccessError
from odoo.tests.common import tagged

@tagged('access_rights', 'knowledge_tests', 'knowledge_article_access_control')
class TestKnowledgeArticleAccessControl(TestKnowledgeCommon):
    def test_knowledge_article_access_control(self):
        article = self.env['knowledge.article'].create({
            'name': 'Article',
            'body': 'Hello world',
            'internal_permission': 'none',
            'article_member_ids': [(0, 0, {
                'partner_id': self.env.ref('base.partner_admin').id,
                'permission': 'write'
            })],
        })

        # user demo
        with self.assertRaises(AccessError, msg='base.group_user should not be allowed to read an article when the internal permission is set to "none"'):
            article.with_user(self.user_demo).check_access_rule('read')
            article.with_user(self.user_demo).check_access_rights('read')
        with self.assertRaises(AccessError, msg='base.group_user should not be allowed to write on an article when the internal permission is set to "none"'):
            article.with_user(self.user_demo).check_access_rule('write')
            article.with_user(self.user_demo).check_access_rights('write')

        self.assertFalse(article.with_user(self.user_demo).user_has_access)
        self.assertFalse(article.with_user(self.user_demo).user_can_write)

        # user admin
        try:
            article.with_user(self.user_admin).check_access_rule('read')
            article.with_user(self.user_admin).check_access_rights('read')
        except AccessError:
            self.fail('base.group_system should be allowed to read an article when the internal permissions is set to "none"')
        try:
            article.with_user(self.user_admin).check_access_rule('write')
            article.with_user(self.user_admin).check_access_rights('write')
        except AccessError:
            self.fail('base.group_system should be allowed to write on an article when the internal permissions is set to "none"')

        self.assertTrue(article.with_user(self.user_admin).user_has_access)
        self.assertTrue(article.with_user(self.user_admin).user_can_write)

        article.write({'internal_permission': 'read'})

        # user demo
        try:
            article.with_user(self.user_demo).check_access_rule('read')
            article.with_user(self.user_demo).check_access_rights('read')
        except AccessError:
            self.fail('base.group_user should be allowed to read an article when the internal permission is set to "read"')
        with self.assertRaises(AccessError, msg='base.group_user should not be allowed to write on an article when the internal permission is set to "read"'):
            article.with_user(self.user_demo).check_access_rule('write')
            article.with_user(self.user_demo).check_access_rights('write')

        self.assertTrue(article.with_user(self.user_demo).user_has_access)
        self.assertFalse(article.with_user(self.user_demo).user_can_write)

        # user admin
        try:
            article.with_user(self.user_admin).check_access_rule('read')
            article.with_user(self.user_admin).check_access_rights('read')
        except AccessError:
            self.fail('base.group_system should be allowed to read an article when the internal permission is set to "read"')
        try:
            article.with_user(self.user_admin).check_access_rule('write')
            article.with_user(self.user_admin).check_access_rights('write')
        except AccessError:
            self.fail('base.group_system should be allowed to write on an article when the internal permission is set to "read"')

        self.assertTrue(article.with_user(self.user_admin).user_has_access)
        self.assertTrue(article.with_user(self.user_admin).user_can_write)

        article.write({'internal_permission': 'write'})

        # user demo
        try:
            article.with_user(self.user_demo).check_access_rule('read')
            article.with_user(self.user_demo).check_access_rights('read')
        except AccessError:
            self.fail('base.group_user should be allowed to read an article when the internal permission is set to "write"')
        try:
            article.with_user(self.user_demo).check_access_rule('write')
            article.with_user(self.user_demo).check_access_rights('write')
        except AccessError:
            self.fail('base.group_user should be allowed to write on an article when the internal permission is set to "write"')

        self.assertTrue(article.with_user(self.user_demo).user_has_access)
        self.assertTrue(article.with_user(self.user_demo).user_can_write)

        # user admin
        try:
            article.with_user(self.user_admin).check_access_rule('read')
            article.with_user(self.user_admin).check_access_rights('read')
        except AccessError:
            self.fail('base.group_system should be allowed to read an article when the internal permission is set to "write"')
        try:
            article.with_user(self.user_admin).check_access_rule('write')
            article.with_user(self.user_admin).check_access_rights('write')
        except AccessError:
            self.fail('base.group_system should be allowed to write on an article when the internal permission is set to "write"')

        self.assertTrue(article.with_user(self.user_admin).user_has_access)
        self.assertTrue(article.with_user(self.user_admin).user_can_write)

    def test_knowledge_article_access_control_with_membership(self):
        article = self.env['knowledge.article'].create({
            'name': 'Article',
            'body': 'Hello world',
            'internal_permission': 'none',
            'article_member_ids': [(0, 0, {
                'partner_id': self.env.ref('base.partner_admin').id,
                'permission': 'write'
            })],
        })

        user_demo_member = self.env['knowledge.article.member'].create({
            'partner_id': self.partner_demo.id,
            'article_id': article.id,
            'permission': 'none'
        })
        user_admin_member = self.env['knowledge.article.member'].create({
            'partner_id': self.partner_admin.id,
            'article_id': article.id,
            'permission': 'none'
        })

        # user demo
        with self.assertRaises(AccessError, msg='base.group_user should not be allowed to read an article when their permission is set to "none"'):
            article.with_user(self.user_demo).check_access_rule('read')
            article.with_user(self.user_demo).check_access_rights('read')
        with self.assertRaises(AccessError, msg='base.group_user should not be allowed to write on an article when their permission is set to "none"'):
            article.with_user(self.user_demo).check_access_rule('write')
            article.with_user(self.user_demo).check_access_rights('write')

        self.assertFalse(article.with_user(self.user_demo).user_has_access)
        self.assertFalse(article.with_user(self.user_demo).user_can_write)

        # user admin
        try:
            article.with_user(self.user_admin).check_access_rule('read')
            article.with_user(self.user_admin).check_access_rights('read')
        except AccessError:
            self.fail('base.group_system should be allowed to read an article when their permission is set to "none"')
        try:
            article.with_user(self.user_admin).check_access_rule('write')
            article.with_user(self.user_admin).check_access_rights('write')
        except AccessError:
            self.fail('base.group_system should be allowed to write on an article when their permission is set to "none"')

        self.assertTrue(article.with_user(self.user_admin).user_has_access)
        self.assertTrue(article.with_user(self.user_admin).user_can_write)

        user_demo_member.write({'permission': 'read'})
        user_admin_member.write({'permission': 'read'})

        # user demo
        try:
            article.with_user(self.user_demo).check_access_rule('read')
            article.with_user(self.user_demo).check_access_rights('read')
        except AccessError:
            self.fail('base.group_user should be allowed to read an article when their permission is set to "read"')
        with self.assertRaises(AccessError, msg='base.group_user should not be allowed to write on an article when their permission is set to "read"'):
            article.with_user(self.user_demo).check_access_rule('write')
            article.with_user(self.user_demo).check_access_rights('write')

        self.assertTrue(article.with_user(self.user_demo).user_has_access)
        self.assertFalse(article.with_user(self.user_demo).user_can_write)

        # user admin
        try:
            article.with_user(self.user_admin).check_access_rule('read')
            article.with_user(self.user_admin).check_access_rights('read')
        except AccessError:
            self.fail('base.group_system should be allowed to read an article when their permission is set to "read"')
        try:
            article.with_user(self.user_admin).check_access_rule('write')
            article.with_user(self.user_admin).check_access_rights('write')
        except AccessError:
            self.fail('base.group_system should be allowed to write on an article when their permission is set to "read"')

        self.assertTrue(article.with_user(self.user_admin).user_has_access)
        self.assertTrue(article.with_user(self.user_admin).user_can_write)

        user_demo_member.write({'permission': 'write'})
        user_admin_member.write({'permission': 'write'})

        # user demo
        try:
            article.with_user(self.user_demo).check_access_rule('read')
            article.with_user(self.user_demo).check_access_rights('read')
        except AccessError:
            self.fail('base.group_user should be allowed to read an article when their permission is set to "write"')
        try:
            article.with_user(self.user_demo).check_access_rule('read')
            article.with_user(self.user_demo).check_access_rights('read')
        except AccessError:
            self.fail('base.group_system should be allowed to write on an article when their permission is set to "write"')

        self.assertTrue(article.with_user(self.user_demo).user_has_access)
        self.assertTrue(article.with_user(self.user_demo).user_can_write)

        # user admin
        try:
            article.with_user(self.user_admin).check_access_rule('read')
            article.with_user(self.user_admin).check_access_rights('read')
        except AccessError:
            self.fail('base.group_system should be allowed to read an article when their permission is set to "write"')
        try:
            article.with_user(self.user_admin).check_access_rule('write')
            article.with_user(self.user_admin).check_access_rights('write')
        except AccessError:
            self.fail('base.group_system should be allowed to write on an article when their permission is set to "write"')

        self.assertTrue(article.with_user(self.user_admin).user_has_access)
        self.assertTrue(article.with_user(self.user_admin).user_can_write)
