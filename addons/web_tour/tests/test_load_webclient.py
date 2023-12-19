# # -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests import tagged, HttpCase
import time

@tagged('post_install', '-at_install')
class TestLoadWebClient(HttpCase):
    def test_load_webclient(self):
        view = self.env.ref("web.webclient_bootstrap")
        view.arch_db = view.arch_db.replace("fetch(`/web/webclient/translations/${cache_hashes.translations}?lang=${user_context.lang}`);", "console.log('REPLACED FETCH PLACEHOLDER')")
        for _ in range(100):
            self.start_tour("/web", 'load_webclient', login='admin')
