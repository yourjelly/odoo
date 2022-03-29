# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.knowledge.tests.common import TestKnowledgeCommon
from odoo.exceptions import AccessError
from odoo.tests.common import tagged

@tagged('access_rights', 'knowledge_tests', 'knowledge_article_member_access_control')
class TestKnowledgeArticleMemberAccessControl(TestKnowledgeCommon):
    def test_knowledge_article_member_access_control(self):
        article = self.env['knowledge.article'].create({
            'name': 'Article',
            'body': 'Hello world',
            'internal_permission': 'none',
            'article_member_ids': [(0, 0, {
                'partner_id': self.env.ref('base.partner_admin').id,
                'permission': 'write'
            })],
        })

        members = article.article_member_ids

        # user demo
        with self.assertRaises(AccessError, msg='base.group_user should not be allowed to see the article members when the internal permission is set to "none"'):
            members.with_user(self.user_demo).check_access_rule('read')
            members.with_user(self.user_demo).check_access_rights('read')
        with self.assertRaises(AccessError, msg='base.group_user should not be allowed to add new article members when the internal permission is set to "none"'):
            members.with_user(self.user_demo).check_access_rule('write')
            members.with_user(self.user_demo).check_access_rights('write')

        # user admin
        try:
            members.with_user(self.user_admin).check_access_rule('read')
            members.with_user(self.user_admin).check_access_rights('read')
        except AccessError:
            self.fail('base.group_system should be allowed to see the article members when the internal permission is set to "none"')
        try:
            members.with_user(self.user_admin).check_access_rule('read')
            members.with_user(self.user_admin).check_access_rights('read')
        except AccessError:
            self.fail('base.group_system should be allowed to add new article members when the internal permission is set to "none"')

        article.write({'internal_permission': 'read'})

        # user demo
        try:
            members.with_user(self.user_demo).check_access_rule('read')
            members.with_user(self.user_demo).check_access_rights('read')
        except AccessError:
            self.fail('base.group_user should be allowed to see the article members when the internal permission is set to "read"')
        with self.assertRaises(AccessError, msg='base.group_user should not be allowed to add new article members when the internal permission is set to "read"'):
            members.with_user(self.user_demo).check_access_rule('write')
            members.with_user(self.user_demo).check_access_rights('write')

        # user admin
        try:
            members.with_user(self.user_admin).check_access_rule('read')
            members.with_user(self.user_admin).check_access_rights('read')
        except AccessError:
            self.fail('base.group_system should be allowed to see the article members when the internal permission is set to "read"')
        try:
            members.with_user(self.user_admin).check_access_rule('write')
            members.with_user(self.user_admin).check_access_rights('write')
        except AccessError:
            self.fail('base.group_system should be allowed to add new article members when the internal permission is set to "read"')

        article.write({'internal_permission': 'write'})

        # user demo
        try:
            members.with_user(self.user_demo).check_access_rule('read')
            members.with_user(self.user_demo).check_access_rights('read')
        except AccessError:
            self.fail('base.group_user should be allowed to see the article members when the internal permission is set to "write"')
        try:
            members.with_user(self.user_demo).check_access_rule('write')
            members.with_user(self.user_demo).check_access_rights('write')
        except AccessError:
            self.fail('base.group_user should be allowed to add new article members when the internal permission is set to "write"')

        # user admin
        try:
            members.with_user(self.user_admin).check_access_rule('read')
            members.with_user(self.user_admin).check_access_rights('read')
        except AccessError:
            self.fail('base.group_system should be allowed to see the article members when the internal permission is set to "write"')
        try:
            members.with_user(self.user_admin).check_access_rule('write')
            members.with_user(self.user_admin).check_access_rights('write')
        except AccessError:
            self.fail('base.group_system should be allowed to add new article members when the internal permission is set to "write"')

    def test_knowledge_article_member_access_control_with_membership(self):
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
            'permission': 'read'
        })
        user_admin_member = self.env['knowledge.article.member'].create({
            'partner_id': self.partner_admin.id,
            'article_id': article.id,
            'permission': 'read'
        })

        members = article.article_member_ids

        # user demo
        try:
            members.with_user(self.user_demo).check_access_rule('read')
            members.with_user(self.user_demo).check_access_rights('read')
        except AccessError:
            self.fail('base.group_user should be allowed to see the article members when their permission is set to "read"')
        with self.assertRaises(AccessError, msg='base.group_user should not be allowed to add new article members when their permission is set to "read"'):
            members.with_user(self.user_demo).check_access_rule('write')
            members.with_user(self.user_demo).check_access_rights('write')

        # user admin
        try:
            members.with_user(self.user_admin).check_access_rule('read')
            members.with_user(self.user_admin).check_access_rights('read')
        except AccessError:
            self.fail('base.group_system should be allowed to see the article members when their permission is set to "read"')
        try:
            members.with_user(self.user_admin).check_access_rule('write')
            members.with_user(self.user_admin).check_access_rights('write')
        except AccessError:
            self.fail('base.group_admin should not be allowed to add new article members when their permission is set to "read"')

        user_demo_member.write({'permission': 'write'})
        user_admin_member.write({'permission': 'write'})

        try:
            members.with_user(self.user_demo).check_access_rule('read')
            members.with_user(self.user_demo).check_access_rights('read')
        except AccessError:
            self.fail('base.group_user should be allowed to see the article members when their permission is set to "write"')
        try:
            members.with_user(self.user_demo).check_access_rule('write')
            members.with_user(self.user_demo).check_access_rights('write')
        except AccessError:
            self.fail('base.group_user should not be allowed to add new article members when their permission is set to "write"')

        try:
            members.with_user(self.user_admin).check_access_rule('read')
            members.with_user(self.user_admin).check_access_rights('read')
        except AccessError:
            self.fail('base.group_system should be allowed to see the article members when their permission is set to "write"')
        try:
            members.with_user(self.user_admin).check_access_rule('write')
            members.with_user(self.user_admin).check_access_rights('write')
        except AccessError:
            self.fail('base.group_system should not be allowed to add new article members when their permission is set to "write"')
