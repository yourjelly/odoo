# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import odoo.tests

from odoo.tests.common import BaseCase
from ..models.patch_utils import generate_patch, generate_comparison, apply_patch


@odoo.tests.tagged("post_install", "-at_install", "html_history")
class TestHTMLHistoryDiff(BaseCase):
    mock_revisions = [
        "<p>foo</p><p>bar</p><p>baz</p><p>bax</p>",
        "<p>foo</p><p>baz</p><p>bax</p>",
        "<p>foo</p><p>bar</p><p>baz</p><p>bax</p>",
        "<p>foo</p><p>bax</p>",
        "<b>fo++o</b><p>b++ar</p>",
        "",
        "<p>foo</p><p>bar</p><p>baz</p><p>bax</p>",
        "<p>foo</p><p>ba++r</p><p>baz</p><p>b++ax</p>",
        "<p>foo</p><p>bar</p><p>baz</p><p>bax</p>",
        "<i>xxx</i>",
        "<p>ra<b>nd<b>om</p>",
    ]

    def test_custom_diff(self):
        custom_diff = _custom_diff(self.test_html[1], self.test_html[0])

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
