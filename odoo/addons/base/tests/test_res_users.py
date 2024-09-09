# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from types import SimpleNamespace
from unittest.mock import patch

from odoo import SUPERUSER_ID
from odoo.exceptions import UserError, ValidationError
from odoo.http import _request_stack
from odoo.tests import Form, TransactionCase, new_test_user, tagged, HttpCase, users
from odoo.tools import mute_logger


class TestUsers(TransactionCase):

    def test_name_search(self):
        """ Check name_search on user. """
        User = self.env['res.users']

        test_user = User.create({'name': 'Flad the Impaler', 'login': 'vlad'})
        like_user = User.create({'name': 'Wlad the Impaler', 'login': 'vladi'})
        other_user = User.create({'name': 'Nothing similar', 'login': 'nothing similar'})
        all_users = test_user | like_user | other_user

        res = User.name_search('vlad', operator='ilike')
        self.assertEqual(User.browse(i[0] for i in res) & all_users, test_user)

        res = User.name_search('vlad', operator='not ilike')
        self.assertEqual(User.browse(i[0] for i in res) & all_users, all_users)

        res = User.name_search('', operator='ilike')
        self.assertEqual(User.browse(i[0] for i in res) & all_users, all_users)

        res = User.name_search('', operator='not ilike')
        self.assertEqual(User.browse(i[0] for i in res) & all_users, User)

        res = User.name_search('lad', operator='ilike')
        self.assertEqual(User.browse(i[0] for i in res) & all_users, test_user | like_user)

        res = User.name_search('lad', operator='not ilike')
        self.assertEqual(User.browse(i[0] for i in res) & all_users, other_user)

    def test_user_partner(self):
        """ Check that the user partner is well created """

        User = self.env['res.users']
        Partner = self.env['res.partner']
        Company = self.env['res.company']

        company_1 = Company.create({'name': 'company_1'})
        company_2 = Company.create({'name': 'company_2'})

        partner = Partner.create({
            'name': 'Bob Partner',
            'company_id': company_2.id
        })

        # case 1 : the user has no partner
        test_user = User.create({
            'name': 'John Smith',
            'login': 'jsmith',
            'company_ids': [company_1.id],
            'company_id': company_1.id
        })

        self.assertFalse(
            test_user.partner_id.company_id,
            "The partner_id linked to a user should be created without any company_id")

        # case 2 : the user has a partner
        test_user = User.create({
            'name': 'Bob Smith',
            'login': 'bsmith',
            'company_ids': [company_1.id],
            'company_id': company_1.id,
            'partner_id': partner.id
        })

        self.assertEqual(
            test_user.partner_id.company_id,
            company_1,
            "If the partner_id of a user has already a company, it is replaced by the user company"
        )


    def test_change_user_company(self):
        """ Check the partner company update when the user company is changed """

        User = self.env['res.users']
        Company = self.env['res.company']

        test_user = User.create({'name': 'John Smith', 'login': 'jsmith'})
        company_1 = Company.create({'name': 'company_1'})
        company_2 = Company.create({'name': 'company_2'})

        test_user.company_ids += company_1
        test_user.company_ids += company_2

        # 1: the partner has no company_id, no modification
        test_user.write({
            'company_id': company_1.id
        })

        self.assertFalse(
            test_user.partner_id.company_id,
            "On user company change, if its partner_id has no company_id,"
            "the company_id of the partner_id shall NOT be updated")

        # 2: the partner has a company_id different from the new one, update it
        test_user.partner_id.write({
            'company_id': company_1.id
        })

        test_user.write({
            'company_id': company_2.id
        })

        self.assertEqual(
            test_user.partner_id.company_id,
            company_2,
            "On user company change, if its partner_id has already a company_id,"
            "the company_id of the partner_id shall be updated"
        )

    @mute_logger('odoo.sql_db')
    def test_deactivate_portal_users_access(self):
        """Test that only a portal users can deactivate his account."""
        user_internal = self.env['res.users'].create({
            'name': 'Internal',
            'login': 'user_internal',
            'password': 'password',
            'group_ids': [self.env.ref('base.group_user').id],
        })

        with self.assertRaises(UserError, msg='Internal users should not be able to deactivate their account'):
            user_internal._deactivate_portal_user()

    @mute_logger('odoo.sql_db', 'odoo.addons.base.models.res_users_deletion')
    def test_deactivate_portal_users_archive_and_remove(self):
        """Test that if the account can not be removed, it's archived instead
        and sensitive information are removed.

        In this test, the deletion of "portal_user" will succeed,
        but the deletion of "portal_user_2" will fail.
        """
        User = self.env['res.users']
        portal_user = User.create({
            'name': 'Portal',
            'login': 'portal_user',
            'password': 'password',
            'group_ids': [self.env.ref('base.group_portal').id],
        })
        portal_partner = portal_user.partner_id

        portal_user_2 = User.create({
            'name': 'Portal',
            'login': 'portal_user_2',
            'password': 'password',
            'group_ids': [self.env.ref('base.group_portal').id],
        })
        portal_partner_2 = portal_user_2.partner_id

        (portal_user | portal_user_2)._deactivate_portal_user()

        self.assertTrue(portal_user.exists() and not portal_user.active, 'Should have archived the user 1')

        self.assertEqual(portal_user.name, 'Portal', 'Should have kept the user name')
        self.assertEqual(portal_user.partner_id.name, 'Portal', 'Should have kept the partner name')
        self.assertNotEqual(portal_user.login, 'portal_user', 'Should have removed the user login')

        asked_deletion_1 = self.env['res.users.deletion'].search([('user_id', '=', portal_user.id)])
        asked_deletion_2 = self.env['res.users.deletion'].search([('user_id', '=', portal_user_2.id)])

        self.assertTrue(asked_deletion_1, 'Should have added the user 1 in the deletion queue')
        self.assertTrue(asked_deletion_2, 'Should have added the user 2 in the deletion queue')

        # The deletion will fail for "portal_user_2",
        # because of the absence of "ondelete=cascade"
        self.cron = self.env['ir.cron'].create({
            'name': 'Test Cron',
            'user_id': portal_user_2.id,
            'model_id': self.env.ref('base.model_res_partner').id,
        })

        self.env['res.users.deletion']._gc_portal_users()

        self.assertFalse(portal_user.exists(), 'Should have removed the user')
        self.assertFalse(portal_partner.exists(), 'Should have removed the partner')
        self.assertEqual(asked_deletion_1.state, 'done', 'Should have marked the deletion as done')

        self.assertTrue(portal_user_2.exists(), 'Should have kept the user')
        self.assertTrue(portal_partner_2.exists(), 'Should have kept the partner')
        self.assertEqual(asked_deletion_2.state, 'fail', 'Should have marked the deletion as failed')

    def test_user_home_action_restriction(self):
        test_user = new_test_user(self.env, 'hello world')

        # Find an action that contains restricted context ('active_id')
        restricted_action = self.env['ir.actions.act_window'].search([('context', 'ilike', 'active_id')], limit=1)
        with self.assertRaises(ValidationError):
            test_user.action_id = restricted_action.id

        # Find an action without restricted context
        allowed_action = self.env['ir.actions.act_window'].search(['!', ('context', 'ilike', 'active_id')], limit=1)

        test_user.action_id = allowed_action.id
        self.assertEqual(test_user.action_id.id, allowed_action.id)

    def test_context_get_lang(self):
        self.env['res.lang'].with_context(active_test=False).search([
            ('code', 'in', ['fr_FR', 'es_ES', 'de_DE', 'en_US'])
        ]).write({'active': True})

        user = new_test_user(self.env, 'jackoneill')
        user = user.with_user(user)
        user.lang = 'fr_FR'

        company = user.company_id.partner_id.sudo()
        company.lang = 'de_DE'

        request = SimpleNamespace()
        request.best_lang = 'es_ES'
        request_patch = patch('odoo.addons.base.models.res_users.request', request)
        self.addCleanup(request_patch.stop)
        request_patch.start()

        self.assertEqual(user.context_get()['lang'], 'fr_FR')
        self.env.registry.clear_cache()
        user.lang = False

        self.assertEqual(user.context_get()['lang'], 'es_ES')
        self.env.registry.clear_cache()
        request_patch.stop()

        self.assertEqual(user.context_get()['lang'], 'de_DE')
        self.env.registry.clear_cache()
        company.lang = False

        self.assertEqual(user.context_get()['lang'], 'en_US')

@tagged('post_install', '-at_install')
class TestUsers2(TransactionCase):

    def test_change_user_login(self):
        """ Check that partner email is updated when changing user's login """

        User = self.env['res.users']
        with Form(User, view='base.view_users_form') as UserForm:
            UserForm.name = "Test User"
            UserForm.login = "test-user1"
            self.assertFalse(UserForm.email)

            UserForm.login = "test-user1@mycompany.example.org"
            self.assertEqual(
                UserForm.email, "test-user1@mycompany.example.org",
                "Setting a valid email as login should update the partner's email"
            )

    def test_reified_groups(self):
        """ The groups handler doesn't use the "real" view with pseudo-fields
        during installation, so it always works (because it uses the normal
        group_ids field).
        """
        # use the specific views which has the pseudo-fields
        f = Form(self.env['res.users'], view='base.view_users_form')
        f.name = "bob"
        f.login = "bob"
        user = f.save()

        self.assertIn(self.env.ref('base.group_user'), user.group_ids)

        # all template user groups are copied
        default_user = self.env.ref('base.default_user')
        self.assertEqual(default_user.group_ids, user.group_ids)


class TestUsersTweaks(TransactionCase):
    def test_superuser(self):
        """ The superuser is inactive and must remain as such. """
        user = self.env['res.users'].browse(SUPERUSER_ID)
        self.assertFalse(user.active)
        with self.assertRaises(UserError):
            user.write({'active': True})


@tagged('post_install', '-at_install')
class TestUsersIdentitycheck(HttpCase):

    @users('admin')
    def test_revoke_all_devices(self):
        """
        Test to check the revoke all devices by changing the current password as a new password
        """
        # Change the password to 8 characters for security reasons
        self.env.user.password = "admin@odoo"

        # Create a first session that will be used to revoke other sessions
        session = self.authenticate('admin', 'admin@odoo')

        # Create a second session that will be used to check it has been revoked
        self.authenticate('admin', 'admin@odoo')
        # Test the session is valid
        # Valid session -> not redirected from /web to /web/login
        self.assertTrue(self.url_open('/web').url.endswith('/web'))

        # Push a fake request to the request stack, because @check_identity requires a request.
        # Use the first session created above, used to invalid other sessions than itself.
        _request_stack.push(SimpleNamespace(session=session, env=self.env))
        self.addCleanup(_request_stack.pop)
        # The user clicks the button logout from all devices from his profile
        action = self.env.user.action_revoke_all_devices()
        # The form of the check identity wizard opens
        form = Form(self.env[action['res_model']].browse(action['res_id']), action.get('view_id'))
        # The user fills his password
        form.password = 'admin@odoo'
        # The user clicks the button "Log out from all devices", which triggers a save then a call to the button method
        user_identity_check = form.save()
        action = user_identity_check.run_check()

        # Test the session is no longer valid
        # Invalid session -> redirected from /web to /web/login
        self.assertTrue(self.url_open('/web').url.endswith('/web/login?redirect=%2Fweb%3F'))

        # In addition, the password must have been emptied from the wizard
        self.assertFalse(user_identity_check.password)
