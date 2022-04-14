# -*- coding: utf-8 -*-

import timeit
from inspect import cleandoc
from odoo.addons.base.models.ir_qweb import QWebException
from odoo.addons.mail.tests import common
from lxml import html


class SafeExprQWebTester(common.MailCommon):
    def render_qweb(self, expr, ctx={}, bench=False):
        if bench:
            with_checks = 0
            without_checks = 0

            for _ in range(5):
                with_checks += timeit.timeit(
                    cleandoc(
                        """
                    self.env['ir.qweb']._render(
                        html.fragment_fromstring(expr, create_parent="div"), ctx
                    )
                    """
                    ),
                    number=500,
                    globals={"self": self, "expr": expr, "ctx": ctx, "html": html},
                )

                without_checks += timeit.timeit(
                    cleandoc(
                        """
                    self.env['ir.qweb'].with_context(benchmark_mode=True)._render(
                        html.fragment_fromstring(expr, create_parent="div"), ctx
                    )
                    """
                    ),
                    number=500,
                    globals={"self": self, "expr": expr, "ctx": ctx, "html": html},
                )

            print(f"Average time without checks: {without_checks / 5}")
            print(f"Average time with checks: {with_checks / 5}")

        return self.env["ir.qweb"]._render(
            html.fragment_fromstring(expr, create_parent="div"), ctx
        )

    def render_qweb_render_mixin(self, expr, model, res_id, bench=False):
        with_checks = 0
        without_checks = 0

        if bench:
            for _ in range(5):
                with_checks += timeit.timeit(
                    cleandoc(
                        """
                    self.env["mail.render.mixin"]._render_template(
                        expr, model, res_id, engine="qweb"
                    )
                    """
                    ),
                    number=500,
                    globals={
                        "self": self,
                        "expr": expr,
                        "model": model,
                        "res_id": res_id,
                    },
                )

                without_checks += timeit.timeit(
                    cleandoc(
                        """ 
                    self.env["mail.render.mixin"].with_context(
                        benchmark_mode=True
                    )._render_template(expr, model, res_id, engine="qweb")
                    """
                    ),
                    number=500,
                    globals={
                        "self": self,
                        "expr": expr,
                        "model": model,
                        "res_id": res_id,
                    },
                )

            print(f"Average time without checks: {without_checks / 5}")
            print(f"Average time with checks: {with_checks / 5}")

        return self.env["mail.render.mixin"]._render_template(
            expr, model, res_id, engine="qweb"
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
        """.replace(
            " ", ""
        ).replace(
            "\n", ""
        )

        self.assertEqual(
            self.render_qweb(code, bench=True).replace(" ", "").replace("\n", ""),
            result,
        )

    def test_benchmark(self):
        partner = self.env["res.partner"]

        test_partner_id = partner.create(
            {
                "name": "Johnny Test",
                "lang": "en_US",
                "comment": "A very good person, but a bit too experimental",
            }
        )

        code = cleandoc(
            """
        <p><t t-esc="object.name" /></p>
        <p><t t-esc="object.lang" /></p>
        <t t-esc="object.comment" />
        """
        )

        self.render_qweb_render_mixin(code, test_partner_id._name, test_partner_id.ids, bench=True)[
            test_partner_id.id
        ]
