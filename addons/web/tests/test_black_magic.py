# pip install webdriver-manager selenium pandas

from lxml import etree
import odoo.tests
from werkzeug import urls

import logging
import time
import re

_logger = logging.getLogger(__name__)

@odoo.tests.tagged('black_magic', '-at_install', 'post_install')
class BlackMagicCrawler(odoo.tests.HttpCase):
    def test_10_crawl_admin(self):
        menus = self.env['ir.ui.menu'].load_menus(False)
        app_ids = menus['root']['children']
        app_ids = [1132]
        for app_id in app_ids:
            with self.subTest(app=menus[app_id]['name']):
                url = "/web#menu_id=1132&action=1660&model=estate.property&cids=1%2C2%2C3%2C4%2C5&view_type=form&id=2"
                
                _logger.runbot('Testing %s', menus[app_id]['name'])
                self.browser_js(url, "console.log(odoo.xss2); ", "odoo.isReady === true", login="admin")
                self.terminate_browser()

# TODO solve problem to differenciate console log and console error...