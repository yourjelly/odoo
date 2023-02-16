# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import json
import odoo.tests
from odoo.tests import common
from odoo.tests.common import BaseCase
from odoo.addons.web_editor.models.field_html_history import restore_one, _custom_diff


@odoo.tests.tagged("post_install", "-at_install", "html_history_diff")
class TestHTMLHistoryDiff(BaseCase):
    test_html = [
        "<p>foo</p><p>bar</p><p>baz</p>",
        "<p>foo2</p><p>b</p>",
        "<b>foo3</b><p>bar</p>",
        "<p>foo4</p><p>bar bar bar</p>",
        "<p>foo4</p><i>xxx</i><p>bar bar bar</p>",
        "<i>xxx</i>",
        "<p>foo4</p><p>bar bar bar</p>",
        "",
        "<p>foo</p><p>b123r</p>",
    ]

    def test_custom_diff(self):
        custom_diff = json.dumps(list(_custom_diff(self.test_html[1], self.test_html[0])))
        self.assertEqual('["R|2<p>foo", "R|4<p>bar", "+|5<p>baz</p>"]', custom_diff)

    def test_restore_one(self):
        custom_diff = list(_custom_diff(self.test_html[1], self.test_html[0]))
        restored = restore_one(self.test_html[1], custom_diff)
        self.assertEqual(restored, self.test_html[0])

    def test_restore_all(self):
        custom_diff = []
        for i in range(1, len(self.test_html)).__reversed__():
            custom_diff.append(json.dumps(list(_custom_diff(self.test_html[i], self.test_html[i-1]))))

        restored = self.test_html[-1]
        for diff in custom_diff:
            restored = restore_one(restored, json.loads(diff))

        self.assertEqual(restored, self.test_html[0])
