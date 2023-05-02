from lxml import etree
from odoo.tests.common import tagged
from odoo.addons.base.tests.common import HttpCaseWithUserDemo
from werkzeug import urls

import logging
import time
import re

_logger = logging.getLogger(__name__)

@tagged('black_magic')
class BlackMagicCrawler(HttpCaseWithUserDemo):
    def crawl(self, url, seen = {}):
        url_slug = re.sub(r"[/](([^/=?&]+-)?[0-9]+)([/]|$)", '/<slug>/', url) # replaces /abc-123/ by /<slug>/
        url_slug = re.sub(r"([^/=?&]+)=[^/=?&]+", '\g<1>=param', url_slug) # replaces abcb=1234 by abcd=param
        if url_slug in seen:
            return seen
        else:
            seen[url_slug] = True

        print(url)

        r = self.url_open(url, allow_redirects=False)
        if r.status_code in (301, 302, 303):
            # check local redirect to avoid fetch externals pages
            new_url = r.headers.get('Location')
            current_url = r.url
            if urls.url_parse(new_url).netloc != urls.url_parse(current_url).netloc:
                return seen
            r = self.url_open(new_url)

        code = r.status_code
        self.assertIn(code, range(200, 300), "Fetching %s returned error response (%d)" % (url, code))

        if r.headers['Content-Type'].startswith('text/html'):
            parser = etree.HTMLParser()
            doc = etree.fromstring(r.content, parser=parser)
            
            # 1. Get the links in page
            links = doc.xpath('//a[@href]')

            # 2. Get the links in scripts
            r = r'''<a href='[/\w]+'>'''
            for script in doc.xpath('//script'):
                result = re.search(r, str(script.text))
                if result:
                    tag = etree.fromstring(result.group(), parser=parser)
                    links += tag.xpath('//a[@href]')
            
            for link in links:
                href = link.get('href')

                parts = urls.url_parse(href)
                # href with any fragment removed
                href = parts.replace(fragment='').to_url()
                
                # FIXME: handle relative link (not parts.path.startswith /)
                if parts.netloc or \
                    not parts.path.startswith('/') or \
                    parts.path == '/web' or\
                    parts.path.startswith('/web/') or \
                    parts.path.startswith('/en_US/') or \
                    (parts.scheme and parts.scheme not in ('http', 'https')):
                    continue

                self.crawl(href, seen)

        return seen

    def test_10_crawl_admin(self):
        t0 = time.time()
        t0_sql = self.registry.test_cr.sql_log_count
        self.authenticate('admin', 'admin')
        seen = self.crawl('/')
        count = len(seen)
        duration = time.time() - t0
        sql = self.registry.test_cr.sql_log_count - t0_sql
        _logger.runbot("admin crawled %s urls in %.2fs %s queries, %.3fs %.2fq per request", count, duration, sql, duration / count, float(sql) / count)
