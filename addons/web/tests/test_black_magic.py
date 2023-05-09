from lxml import etree
import odoo.tests
from werkzeug import urls

import logging
import time
import re

_logger = logging.getLogger(__name__)

@odoo.tests.tagged('black_magic', '-at_install', 'post_install')
class BlackMagicCrawler(odoo.tests.HttpCase):
    def get_urls(self):
        views = self.env['ir.actions.act_window'].search_read(
            domain=[["res_model", "ilike", "estate"]],
            fields=["id", "view_mode", "res_model"]
        )
        urls = []
        for view in views:
            modes = view["view_mode"].split(',')

            for mode in modes:
                url = f"/web#action_id={view['id']}&model={view['res_model']}&cids=1%2C2%2C3%2C4%2C5&view_type={mode}"
                if mode == 'search':
                    continue
                
                if mode == 'form':
                    url += "&id=1"
                        # ids = self.env[view['model']].search_read(
                        #     domain=[],fields=['id'],limit=1#,order="write_date DESC"
                        # )
                        # if ids:
                        #     url += f"&id={ids[0]['id']}"
                    
                
                urls.append(url)

        return urls

    def test_10_crawl_admin(self):
        code = """
            const MOUSE_EVENTS = ["click"];

            async function triggerClick(target, elDescription) {
                if (target) {
                    console.log("Clicking on", elDescription);
                } else {
                    throw new Error(`No element "${elDescription}" found.`);
                }
                MOUSE_EVENTS.forEach((type) => {
                    const event = new MouseEvent(type, { bubbles: true, cancelable: true, view: window });
                    target.dispatchEvent(event);
                });
            }

            function sleep(ms) {
                return new Promise(resolve => setTimeout(resolve, ms));
            }

            async function click_notebook() {
                const pages = document.querySelectorAll("div.o_notebook_headers > ul.nav > li.nav-item > a.nav-link.undefined");
                if(!pages) {
                    return;
                }
                for (const page of pages) {
                    await triggerClick(page, page);
                    await sleep(1000);
                }
            }

            async function test() {
                await sleep(3000)
                await click_notebook();
                console.log('test successful');
            }

            test()
        """
        urls = self.get_urls()
        #urls = ['/web#id=75&cids=1%2C2%2C3%2C4%2C5&menu_id=874&model=sale.order&view_type=form']
        ctr = 0
        for url in urls:
            with self.subTest(url):
                print('Left', ctr/len(urls), ':', url)
                ctr+=1
                self.browser_js(url, code, "odoo.isReady === true", login="admin", watch=False)
                self.terminate_browser()
        
        # TO_CHECK optimize by checking if the view _id are different for different action, 
        # If not simply skip since we've already seen it.