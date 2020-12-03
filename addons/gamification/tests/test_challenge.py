# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.base.tests.common import TransactionCaseWithUserDemo
from odoo.exceptions import UserError
from datetime import date, timedelta

class TestGamificationCommon(TransactionCaseWithUserDemo):

    def setUp(self):
        super(TestGamificationCommon, self).setUp()
        self.employees_group = self.env.ref('base.group_user')
        self.user_ids = self.employees_group.users

        # Push demo user into the challenge before creating a new one
        self.env.ref('gamification.challenge_base_discover')._update_all()
        self.robot = self.env['res.users'].with_context(no_reset_password=True).create({
            'name': 'R2D2',
            'login': 'r2d2@openerp.com',
            'email': 'r2d2@openerp.com',
            'groups_id': [(6, 0, [self.employees_group.id])]
        })
        self.badge_good_job = self.env.ref('gamification.badge_good_job')


class test_challenge(TestGamificationCommon):

    def test_00_join_challenge(self):
        challenge = self.env.ref('gamification.challenge_base_discover')
        self.assertGreaterEqual(len(challenge.user_ids), len(self.user_ids), "Not enough users in base challenge")
        challenge._update_all()
        self.assertGreaterEqual(len(challenge.user_ids), len(self.user_ids)+1, "These are not droids you are looking for")

    def test_10_reach_challenge(self):
        Goals = self.env['gamification.goal']
        challenge = self.env.ref('gamification.challenge_base_discover')

        challenge.state = 'inprogress'
        self.assertEqual(challenge.state, 'inprogress', "Challenge failed the change of state")

        goal_ids = Goals.search([('challenge_id', '=', challenge.id), ('state', '!=', 'draft')])
        self.assertEqual(len(goal_ids), len(challenge.line_ids) * len(challenge.user_ids.ids), "Incorrect number of goals generated, should be 1 goal per user, per challenge line")

        demo = self.user_demo
        # demo user will set a timezone
        demo.tz = "Europe/Brussels"
        goal_ids = Goals.search([('user_id', '=', demo.id), ('definition_id', '=', self.env.ref('gamification.definition_base_timezone').id)])

        goal_ids.update_goal()

        missed = goal_ids.filtered(lambda g: g.state != 'reached')
        self.assertFalse(missed, "Not every goal was reached after changing timezone")

        # reward for two firsts as admin may have timezone
        badge_id = self.badge_good_job.id
        challenge.write({'reward_first_id': badge_id, 'reward_second_id': badge_id})
        challenge.state = 'done'

        badge_ids = self.env['gamification.badge.user'].search([('badge_id', '=', badge_id), ('user_id', '=', demo.id)])
        self.assertEqual(len(badge_ids), 1, "Demo user has not received the badge")

    def update_goals(self, challenge):
        # make all goals older than most recent login time so they are included in the upcoming _update_all()
        self.cr.execute("UPDATE gamification_goal SET write_date = '1970-01-01' WHERE challenge_id = %s", (challenge.id,))
        self.env['gamification.goal'].invalidate_cache()
        challenge._update_all()

    def test_20_batch_goals(self):
        signature_goal_definition = self.env['gamification.goal.definition'].create({
            'name': 'Set a secret signature',
            'computation_mode': 'count',
            'model_id': self.env.ref('base.model_res_users').id,
            'domain': '[("signature", "=", "secret")]',
            'batch_mode': True,
            'batch_distinctive_field': self.env.ref('base.field_res_users__id').id,
            'batch_user_expression': 'user.id',
        })
        challenge_users = self.env['res.users']
        for i in range(3):
            challenge_users |= self.env['res.users'].with_context(no_reset_password=True).create({
                'name': 'Challenge user %s' % i,
                'login': '%s@openerp.com' % i,
                'email': '%s@openerp.com' % i,
                'groups_id': [(6, 0, [self.employees_group.id])],
                'signature': '',
            })

        # consider all challenge users recently logged in
        for user in challenge_users:
            user.with_user(user)._update_last_login()

        challenge = self.env['gamification.challenge'].create({
            'name': 'Signature challenge',
            'user_ids': [(6, 0, challenge_users.ids)],
            'line_ids': [(0, 0, {'definition_id': signature_goal_definition.id, 'target_goal': 1})],
        })

        for user in challenge_users:
            self.assertEqual(user.signature, '', 'signature of user %s should be empty' % user.display_name)

        challenge._generate_goals_from_challenge()
        self.assertEqual(
            self.env['gamification.goal'].search_count([('challenge_id', '=', challenge.id), ('state', '=', 'inprogress')]),
            3,
            'should have generated 3 in-progress goals (1 for each user)'
        )

        self.update_goals(challenge)
        self.assertEqual(
            self.env['gamification.goal'].search_count([('challenge_id', '=', challenge.id), ('state', '=', 'inprogress')]),
            3,
            'no goals should be reached (signatures are all empty)'
        )

        challenge_users[1].signature = 'secret'
        self.update_goals(challenge)
        self.assertEqual(
            self.env['gamification.goal'].search_count([('challenge_id', '=', challenge.id), ('state', '=', 'inprogress')]),
            2,
            '2 goals should remain'
        )
        self.assertEqual(
            self.env['gamification.goal'].search_count([('challenge_id', '=', challenge.id), ('state', '=', 'reached')]),
            1,
            '1 goal should be reached'
        )


class test_badge_wizard(TestGamificationCommon):

    def test_grant_badge(self):
        wiz = self.env['gamification.badge.user.wizard'].create({
            'user_id': self.env.user.id,
            'badge_id': self.badge_good_job.id,
        })
        with self.assertRaises(UserError, msg="A user cannot grant a badge to himself"):
            wiz.action_grant_badge()
        wiz.user_id = self.robot.id
        self.assertTrue(wiz.action_grant_badge(), "Could not grant badge")

        self.assertEqual(self.badge_good_job.stat_this_month, 1)
