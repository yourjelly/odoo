from lxml import etree
import odoo.tests
from werkzeug import urls

import logging
import time

_logger = logging.getLogger(__name__)

@odoo.tests.tagged('black_magic', '-at_install', 'post_install')
class BlackMagicCrawler(odoo.tests.HttpCase):
    def get_urls(self):
        views = self.env['ir.actions.act_window'].search_read(
            domain=[],
            fields=["id", "view_mode", "res_model", "view_id"]
        )
        seen = {}
        urls = []

        for view in views:
            modes = view["view_mode"].split(',')

            for mode in modes: 
                if mode == 'search':
                    continue

                url = f"/web#action_id={view['id']}&model={view['res_model']}&cids=1%2C2%2C3%2C4%2C5&view_type={mode}"

                if (view['res_model'], mode) not in seen:
                    seen[(view['res_model'], mode)] = []
                
                if view['view_id'] not in seen[(view['res_model'], mode)]:
                    seen[(view['res_model'], mode)].append(view['view_id'])
                else:
                    continue
                
                if mode == 'form':
                    if not self.env[view['res_model']]._auto:
                        _logger.info(f'SKIP: {view["res_model"]}: Abstract Model.')
                        continue

                    try:
                        ids = self.env[view['res_model']].search_read(
                            domain=[],fields=['id'],limit=1,order="write_date DESC"
                        )
                    except Exception:
                        ids = self.env[view['res_model']].search_read(
                            domain=[],fields=['id'],limit=1
                        )

                    if ids:
                        url += f"&id={ids[0]['id']}"
                    else:
                        _logger.info(f'SKIP: {url}: No record found for URL.')
                        continue
                
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
        start = time.time()
        for url in urls:
            with self.subTest(url):
                self.browser_js(url, code, "odoo.isReady === true", login="admin", watch=False)
                self.terminate_browser()

        _logger.info(f'Time for test : {time.time() - start}')
