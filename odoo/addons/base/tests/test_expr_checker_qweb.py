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
