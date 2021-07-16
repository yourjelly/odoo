# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo.tests.common import TransactionCase
from odoo.tests import tagged


print('<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<')

@tagged('post_install', '-at_install', 'perf')
class TestNameGet(TransactionCase):

    def setUp(self):
        print('setting up TestNameGet')

    def test_name_get_server_actions(self):
        print('this test run')
        items = self.env['ir.actions.server'].search([])

        def fetch():
            items.invalidate_cache()
            items.name_get()

        def prefetch():
            items.invalidate_cache()
            items._read(['name'])
            items.name_get()

        from timeit import timeit
        time_wo = timeit(fetch, number=1000)
        time_w = timeit(prefetch, number=1000)
        print(f"{time_w}/{time_wo}, prefetching gives an improvement of {(time_wo-time_w)/time_wo:.2%}")
        self.assertTrue(False)
        self.assertTrue(time_w/time_wo > 1.2)

