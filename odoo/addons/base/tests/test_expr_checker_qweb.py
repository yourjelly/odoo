# -*- coding: utf-8 -*-

from odoo.addons.base.models.ir_qweb import QWebException
from odoo.addons.mail.tests import common
from lxml import html


class SafeExprQWebTester(common.MailCommon):
    def render_qweb(self, expr, ctx={}):
        # Grep dans le code with context
        return self.env["ir.qweb"]._render(
            html.fragment_fromstring(expr, create_parent="div"), ctx
        )

    def test_sanity_check(self):
        code = """
            <p>Hello, World !</p> 
        """

        self.render_qweb(code)

    def test_dump_passwd_denied(self):
        code = """
            <t t-foreach="[open('/etc/passwd'), 2, 3]" t-as="i">
                <p><t t-esc="i"/></p>
            </t>        
        """

        self.render_qweb(code)

        with self.assertRaisesRegex(
            QWebException,
            "ValueError: safe_eval didn't like <_io.TextIOWrapper name='/etc/passwd' mode='r' encoding='UTF-8'>",
        ):
            self.render_qweb(code, ctx={"open": open})
            pass

    def test_fibonacci(self):
        code = """
            <t t-set="n1" t-value="0" /> 
            <t t-set="n2" t-value="1" /> 
            <p><t t-esc="n1"/></p>
            <p><t t-esc="n2"/></p>
            <t t-foreach="range(2, 20)" t-as="i">
                <t t-set="next" t-value="n1 + n2" /> 
                <p><t t-esc="next"/></p>
                <t t-set="n1" t-value="n2" /> 
                <t t-set="n2" t-value="next" />
            </t>
        """

        result = """ 
            <div>
                <p>0</p>
                <p>1</p>
                <p>1</p>
                <p>2</p>
                <p>3</p>
                <p>5</p>
                <p>8</p>
                <p>13</p>
                <p>21</p>
                <p>34</p>
                <p>55</p>
                <p>89</p>
                <p>144</p>
                <p>233</p>
                <p>377</p>
                <p>610</p>
                <p>987</p>
                <p>1597</p>
                <p>2584</p>
                <p>4181</p>
            </div>
        """.replace(" ", "").replace("\n", "")

        self.assertEqual(self.render_qweb(code).replace(" ", "").replace("\n", ""), result)
