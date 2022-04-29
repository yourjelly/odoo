# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from lxml import etree

from odoo.addons.knowledge.tests.common import TestKnowledgeCommon
from odoo.addons.mail.tests.common import MailCommon
from odoo.tests.common import tagged, new_test_user


@tagged('access_rights', 'knowledge_tests', 'knowledge_invite')
class TestKnowledgeInvite(MailCommon, TestKnowledgeCommon):
    """This test suite will have the responsibility to test the invitation flow."""
    def test_send_invite_email(self):
        """When a user invites another user, the invited user should receive an invitation email and be able to edit the article."""
        user_demo_1 = new_test_user(self.env, login='user_demo_1', email='user1.demo@example.com', groups='base.group_user')
        user_demo_2 = new_test_user(self.env, login='user_demo_2', email='user2.demo@example.com', groups='base.group_user')
        user_demo_3 = new_test_user(self.env, login='user_demo_3', email='user3.demo@example.com', groups='base.group_user')
        Article = self.env['knowledge.article'].with_user(user_demo_1)
        article_1 = Article.browse(Article.article_create('Article 1', private=True))
        article_2 = Article.browse(Article.article_create('Article 2', private=True, parent_id=article_1.id))

        # user_demo_1 should have "write" access to be able to invite someone
        self.assertEqual(article_1.with_user(user_demo_1).user_permission, 'write')
        self.assertEqual(article_1.with_user(user_demo_2).user_permission, 'none')
        self.assertEqual(article_1.with_user(user_demo_3).user_permission, 'none')
        self.assertEqual(article_2.with_user(user_demo_1).user_permission, 'write')
        self.assertEqual(article_2.with_user(user_demo_2).user_permission, 'none')
        self.assertEqual(article_2.with_user(user_demo_3).user_permission, 'none')

        with self.mock_mail_gateway():
            # user_demo_1 invites user_demo_2 on article_1
            article_1.invite_members(user_demo_2.partner_id, 'write', send_mail=True)

        # user_demo_2 should now have access to article_1 and article_2
        self.assertEqual(article_1.with_user(user_demo_1).user_permission, 'write')
        self.assertEqual(article_1.with_user(user_demo_2).user_permission, 'write')
        self.assertEqual(article_1.with_user(user_demo_3).user_permission, 'none')
        self.assertEqual(article_2.with_user(user_demo_1).user_permission, 'write')
        self.assertEqual(article_2.with_user(user_demo_2).user_permission, 'write')
        self.assertEqual(article_2.with_user(user_demo_3).user_permission, 'none')

        # check that the mail contains the invite url
        mail = self._find_mail_mail_wpartners(user_demo_2.partner_id, False)
        html = etree.fromstring(mail.body_html, parser=etree.HTMLParser())
        href = html.xpath("//a[@href='%s']" % article_1._get_invite_url(user_demo_2.partner_id))
        self.assertTrue(len(href) == 1)

    def test_check_invite_email(self):
        """The email sent to the invited user should redirect the user to the article"""
        user = new_test_user(self.env, login='user', email='user.demo@example.com', groups='base.group_user')
        Article = self.env['knowledge.article'].with_user(user)
        article_1 = Article.browse(Article.article_create('Article 1', private=True))
        article_2 = Article.browse(Article.article_create('Article 2', private=True, parent_id=article_1.id))

        # check the permission of the users:
        self.assertEqual(article_1.with_user(self.user_admin).user_permission, 'write')
        self.assertEqual(article_1.with_user(self.user_demo).user_permission, 'none')
        self.assertEqual(article_1.with_user(self.user_portal).user_permission, 'none')
        self.assertEqual(article_2.with_user(self.user_admin).user_permission, 'write')
        self.assertEqual(article_2.with_user(self.user_demo).user_permission, 'none')
        self.assertEqual(article_2.with_user(self.user_portal).user_permission, 'none')

        # check that the user is properly redirected when clicking on the invitation link of the email

        self.authenticate(self.user_admin.login, self.user_admin.login)
        res = self.url_open(article_1._get_invite_url(self.partner_admin))
        self.assertEqual(res.status_code, 200) # success
        self.logout()

        self.authenticate(self.user_demo.login, self.user_demo.login)
        res = self.url_open(article_1._get_invite_url(self.partner_demo))
        self.assertEqual(res.status_code, 403) # forbidden
        self.logout()

        self.authenticate(self.user_portal.login, self.user_portal.login)
        res = self.url_open(article_1._get_invite_url(self.partner_portal))
        self.assertEqual(res.status_code, 403) # forbidden
        self.logout()

        # user invites the user_admin, user_demo and user_portal
        article_1.invite_members(self.partner_admin + self.partner_demo + self.partner_portal, 'write', send_mail=True)

        # check the permission of the invited users
        self.assertEqual(article_1.with_user(self.user_admin).user_permission, 'write')
        self.assertEqual(article_1.with_user(self.user_demo).user_permission, 'write')
        self.assertEqual(article_1.with_user(self.user_portal).user_permission, 'read')
        self.assertEqual(article_2.with_user(self.user_admin).user_permission, 'write')
        self.assertEqual(article_2.with_user(self.user_demo).user_permission, 'write')
        self.assertEqual(article_2.with_user(self.user_portal).user_permission, 'read')

        # check that the user is properly redirected based on their rights
        self.authenticate(self.user_admin.login, self.user_admin.login)
        res = self.url_open(article_1._get_invite_url(self.partner_admin))
        self.assertEqual(res.status_code, 200) # success
        self.logout()

        self.authenticate(self.user_demo.login, self.user_demo.login)
        res = self.url_open(article_1._get_invite_url(self.partner_demo))
        self.assertEqual(res.status_code, 200) # success
        self.logout()

        self.authenticate(self.user_portal.login, self.user_portal.login)
        res = self.url_open(article_1._get_invite_url(self.partner_portal))
        self.assertEqual(res.status_code, 200) # success
        self.logout()
