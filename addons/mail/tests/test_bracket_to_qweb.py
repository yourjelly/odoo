# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests import BaseCase
from odoo.tools import bracket_to_qweb_instructions

# Convert tuples into string for easier understanding of test output.
def bracket_to_qweb_string(text):
    instructions = bracket_to_qweb_instructions(text)
    string = ''
    for instruction_type, content in instructions:
        if instruction_type == 'text':
            string += content
        if instruction_type == 'eval_escape':
            string += '<t t-out="' + content + '"/>'
        if instruction_type == 'eval':
            string += '<t t-raw="' + content + '"/>'
    return string

class TestBracketToQweb(BaseCase):
    def test_t_out(self):
        text = '${a}'
        self.assertEqual(bracket_to_qweb_string(text), '<t t-out="a"/>')

    def test_t_out_surrounded(self):
        text = "one ${two} tree"
        self.assertEqual(bracket_to_qweb_string(text), 'one <t t-out="two"/> tree')

    def test_multiples_t_out(self):
        text = "one ${two} tree ${four}"
        self.assertEqual(bracket_to_qweb_string(text), 'one <t t-out="two"/> tree <t t-out="four"/>')

    def test_t_out_escaping_dollar(self):
        text = "one \\${two} tree"
        self.assertEqual(bracket_to_qweb_string(text), 'one \\${two} tree')

    def test_t_out_escaping_inside_bracket(self):
        text = r"one ${\}} tree"
        self.assertEqual(bracket_to_qweb_string(text), r'one <t t-out="\}"/> tree')

    def test_t_out_with_quote_and_curly_bracket(self):
        text = "one ${'}'} tree"
        self.assertEqual(bracket_to_qweb_string(text), 'one <t t-out="\'}\'"/> tree')

    def test_t_out_escape_quote(self):
        text = "one ${'\\'}'} tree"
        self.assertEqual(bracket_to_qweb_string(text), 'one <t t-out="\'\\\'}\'"/> tree')

    def test_t_out_escape_double_quote(self):
        text = 'one ${"}"} tree'
        self.assertEqual(bracket_to_qweb_string(text), 'one <t t-out="&quot;}&quot;"/> tree')

    def test_t_out_function_call(self):
        text = 'one ${function(name="two")} tree'
        self.assertEqual(bracket_to_qweb_string(text), 'one <t t-out="function(name=&quot;two&quot;)"/> tree')

    def test_t_raw(self):
        text = 'one ${two | safe } tree'
        self.assertEqual(bracket_to_qweb_string(text), 'one <t t-raw="two"/> tree')
