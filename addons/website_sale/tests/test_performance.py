# -*- coding:utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
import time

from odoo.addons.base.tests.common import HttpCase
# from odoo.addons.website_sale.controllers.main import shop
from odoo.tests.common import tagged
from odoo.tests.common import users, warmup

_logger = logging.getLogger(__name__)


@tagged('post_install', '-at_install', 'website_sale_perf')
class TestWebsiteSalePerf(HttpCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()

    @users('__system__', 'demo')
    @warmup
    def test_website_sale_perf(self):
        with self.assertQueryCount(__system__=49, demo=48):
            response = self.url_open('/shop', timeout=15)
