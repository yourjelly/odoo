# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import api
from odoo.addons.base.tests.common import HttpCaseWithUserPortal
from odoo.tests import tagged, get_db_name


@tagged('post_install', '-at_install')
class TestUi(HttpCaseWithUserPortal):
    def test_01_portal_load_tour(self):
        self.start_tour("/", 'portal_load_homepage', login="portal")

    def test_api_keys_tour(self):
        """ Check that a portal user can create API keys then use these keys
        for RPC. That's basically a copy of TestAPIKeys using the portal user
        (the tour itself is obviously more divergent)
        """
        messages = []
        @api.model
        def log(_, key):
            messages.append(key)
        self.registry['ir.logging'].send_key = log
        @self.addCleanup
        def remove_callback():
            del self.registry['ir.logging'].send_key

        db = get_db_name()
        self.start_tour('/', 'portal_apikeys_tour_setup', login='portal')

        portal_user = self.env['res.users'].search([('login', '=', 'portal')])
        self.assertEqual(len(portal_user.api_key_ids), 1, "the portal user should now have a key")

        [key] = messages

        uid = self.xmlrpc_common.authenticate(db, 'portal', key, {})
        [r] = self.xmlrpc_object.execute_kw(db, uid, key, 'res.users', 'read', [uid, ['login']])
        self.assertEqual(
            r['login'], 'portal',
            "the key should be usable as a way to perform RPC calls"
        )
        self.start_tour('/my/security', 'portal_apikeys_tour_teardown', login='portal')
