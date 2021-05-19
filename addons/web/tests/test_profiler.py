# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import datetime

from unittest.mock import patch

from odoo.tools import mute_logger
from odoo.tests.common import HttpCase, tagged


@tagged('post_install', '-at_install')
class TestWebProfiling(HttpCase):

    @mute_logger('odoo.http')
    def test_profiling_enabled(self):
        with patch('odoo.sql_db.db_connect', return_value=self.env.cr._cnx):
            # since profiling will use a direct connection to the database patch 'db_connect' to ensure we are using the test cursor
            self.authenticate('admin', 'admin')
            last_profile = self.env['ir.profile'].search([], limit=1, order='id desc')
            # Trying to start profiling when not enabled
            self.env['ir.config_parameter'].set_param('base.profiling_enabled_until', '')
            res = self.url_open('/web/profiling?profile=1')
            self.assertEqual(res.code, 500)
            self.assertEqual(res['error']['data']['message'], 'Profiling is not enabled on this database')
            self.assertEqual(last_profile, self.env['ir.profile'].search([], limit=1, order='id desc'))

            # Enable profiling and start blank profiling
            expiration = datetime.datetime.now() + datetime.timedelta(seconds=50)
            self.env['ir.config_parameter'].set_param('base.profiling_enabled_until', expiration)
            res = self.url_open('/web/profiling', data='{"params": {"profile": 1}}').json()
            self.assertTrue(res['result']['profile_session'])
            self.assertEqual(res['result']['profile_modes'], [])
            # Enable sql
            res = self.url_open('/web/profiling', data='{"params": {"sql": 1}}').json()
            self.assertEqual(res['result']['profile_modes'], ['sql'])
            self.assertEqual(last_profile, self.env['ir.profile'].search([], limit=1, order='id desc'), "profiling route shouldn't have been profiled")
            # Profile a page
            res = self.url_open('/web')
            new_profile = self.env['ir.profile'].search([], limit=1, order='id desc')
            self.assertNotEqual(last_profile, new_profile, "A new profile should have been created")
            self.assertEqual(new_profile.name, '/web?')

            self.env['ir.config_parameter'].set_param('base.profiling_enabled_until', datetime.datetime.now() - datetime.timedelta(seconds=1))
            res = self.url_open('/web')
            self.assertEqual(new_profile, self.env['ir.profile'].search([], limit=1, order='id desc'), "profiling should have been automaticaly disabled")

            res = self.url_open('/web/profiling', headers={'Content-Type': 'application/json'}, data='{"params": {"profile": 1}}').json()
            self.assertEqual(res['error']['data']['name'], 'odoo.exceptions.UserError')
            self.assertEqual(res['error']['data']['message'], 'Profiling is not enabled on this database')
