# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.base.tests.common import HttpCaseWithUserDemo
from odoo.tests.common import tagged


@tagged('-at_install', 'post_install')
class WebManifestRoutesTest(HttpCaseWithUserDemo):

    def test_web_manifest_share_target(self):
        response = self.url_open("/web/manifest.webmanifest")
        response.raise_for_status()
        data = response.json()
        self.assertCountEqual(data['share_target'], {
            'action': '/odoo?share_target=trigger',
            'method': 'POST',
            'enctype': 'multipart/form-data',
            'params': {
                'title': 'title',
                'text': 'text',
                'url': 'url',
                'files': [{
                    'name': 'externalMedia',
                    'accept': ['image/*', 'application/pdf'],
                }]
            }
        })
