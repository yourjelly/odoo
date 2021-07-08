# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests import BaseCase
from odoo.tools import parse_inline_template

class TestParseInlineTemplate(BaseCase):
    def test_expression(self):
        text = 'a {{b}} c'
        self.assertEqual(parse_inline_template(text), [('a ', 'b'), (' c', '')])
