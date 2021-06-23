# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests import BaseCase
from odoo.tools import parse_small_qweb

class TestParseSmallQweb(BaseCase):
    def test_expression(self):
        text = '${a}'
        self.assertEqual(parse_small_qweb(text), [('', 'a')])

    def test_t_2(self):
        text = r'$\{a}'
        self.assertEqual(parse_small_qweb(text), [(r'$\{a}', '')])

    def test_t_3(self):
        text = r'\\${a}'
        self.assertEqual(parse_small_qweb(text), [("\\", 'a')])

    def test_expression_surrounded(self):
        text = "one ${two} tree"
        self.assertEqual(parse_small_qweb(text), [('one ', 'two'), (' tree', '')])

    def test_multiples_expression(self):
        text = "one ${two} tree ${four}"
        self.assertEqual(parse_small_qweb(text), [('one ', 'two'), (' tree ', 'four')])

    def test_expression_escaping_dollar(self):
        text = r"one \${two} tree"
        self.assertEqual(parse_small_qweb(text), [(r'one \${two} tree', '')])

    def test_expression_escaping_escaping_dollar(self):
        text = r"one \\${two} tree"
        self.assertEqual(parse_small_qweb(text), [('one \\', 'two'), (' tree', '')])

    def test_expression_escaping_inside_bracket(self):
        text = r"one ${{\}} tree"
        self.assertEqual(parse_small_qweb(text), [(r'one ', '{}'), (' tree', '')])

    def test_expression_escaping_inside_quote_with_curly_bracket(self):
        text = r"one ${'\\}'} tree"
        self.assertEqual(parse_small_qweb(text), [(r'one ', r"'\}'"), (' tree', '')])

    def test_expression_with_quote_and_curly_bracket(self):
        text = "one ${'}'} tree"
        self.assertEqual(parse_small_qweb(text), [('one ', "'}'"), (' tree', '')])

    def test_expression_escape_quote(self):
        text = r"one ${'\'}'} tree"
        self.assertEqual(parse_small_qweb(text), [('one ', r"'\'}'"), (' tree', '')])

    def test_expression_escape_double_quote(self):
        text = 'one ${"}"} tree'
        self.assertEqual(parse_small_qweb(text), [('one ', '"}"'), (' tree', '')])

    def test_expression_function_call(self):
        text = 'one ${function(name="two")} tree'
        self.assertEqual(parse_small_qweb(text), [('one ', 'function(name="two")'), (' tree', '')])

    def test_t_dollar_without_curly_bracket(self):
        text = '100$'
        self.assertEqual(parse_small_qweb(text), [('100$', '')])

    def test_t_dollar_with_curly_bracket(self):
        text = r'100$${one}'
        self.assertEqual(parse_small_qweb(text), [('100$', 'one')])
