# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.


from odoo.addons.knowledge.tests.common import KnowledgeCommon, KnowledgeCommonWData
from odoo.exceptions import AccessError
from odoo.tests.common import tagged, users

@tagged('knowledge_internals')
class TestKnowledgeArticleBusiness(KnowledgeCommonWData):

    @users('employee')
    def test_article_toggle_favorite(self):
        playground_articles = (self.article_workspace + self.workspace_children).with_env(self.env)
        self.assertEqual(playground_articles.mapped('is_user_favorite'), [False, False, False])

        playground_articles[0].action_toggle_favorite()
        playground_articles.invalidate_cache(fnames=['is_user_favorite'])
        self.assertEqual(playground_articles.mapped('is_user_favorite'), [True, False, False])

        # correct uid-based computation
        playground_articles_asmanager = playground_articles.with_user(self.user_employee_manager)
        self.assertEqual(playground_articles_asmanager.mapped('is_user_favorite'), [False, False, False])


@tagged('post_install', '-at_install', 'knowledge')
class TestKnowledgeShare(KnowledgeCommon):

    @users('employee2')
    def test_knowledge_article_share(self):
        # private article of "employee manager"
        knowledge_article_sudo = self.env['knowledge.article'].sudo().create({
            'name': 'Test Article',
            'body': '<p>Content</p>',
            'internal_permission': 'none',
            'article_member_ids': [(0, 0, {
                'partner_id': self.partner_employee_manager.id,
                'permission': 'write',
            })],
        })

        # employee2 is not supposed to be able to share it
        with self.assertRaises(AccessError):
            self._knowledge_article_share(
                knowledge_article_sudo,
                self.partner_portal.ids,
                'read',
            )

        # give employee2 read access on the document
        knowledge_article_sudo.write({
            'article_member_ids': [(0, 0, {
                'partner_id': self.partner_employee2.id,
                'permission': 'read',
            })]
        })

        # still not supposed to be able to share it
        with self.assertRaises(AccessError):
            self._knowledge_article_share(
                knowledge_article_sudo,
                self.partner_portal.ids,
                'read',
            )

        # modify employee2 access to write
        knowledge_article_sudo.article_member_ids.filtered(
            lambda member: member.partner_id == self.partner_employee2
        ).write({'permission': 'write'})

        # now they should be able to share it
        self._knowledge_article_share(
            knowledge_article_sudo,
            self.partner_portal.ids,
            'read',
        )

        # check that portal user received an invitation link
        invitation_message = self.env['mail.message'].search([
            ('partner_ids', 'in', self.partner_portal.id)
        ])
        self.assertEqual(len(invitation_message), 1)
        self.assertIn(
            knowledge_article_sudo._get_invite_url(self.partner_portal),
            invitation_message.body
        )

        with self.with_user('portal_test'):
            # portal should now have read access to the article
            # (re-browse to have the current user context for user_permission)
            self.assertEqual(
                self.env['knowledge.article'].browse(knowledge_article_sudo.id).user_permission,
                'read')

    def _knowledge_article_share(self, article, partner_ids, permission='write'):
        """ Re-browse the article to make sure we have the current user context on it.
        Necessary for all access fields compute methods in knowledge.article. """

        return self.env['knowledge.invite.wizard'].sudo().create({
            'article_id': self.env['knowledge.article'].browse(article.id).id,
            'partner_ids': partner_ids,
        }).action_invite_members()
