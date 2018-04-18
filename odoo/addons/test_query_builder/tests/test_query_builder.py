# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests import common
from odoo.osv.query_builder import Row, Select, Column, Asc, Desc


class TestExpressions(common.TransactionCase):

    def setUp(self):
        self.p = Row('res_partner')
        self.u = Row('res_users')

    def test_eq_expression(self):
        expr = self.u.id == 5
        res = ('("res_users"."id" = %s)', [5])
        self.assertEqual(expr.__to_sql__(), res)

    def test_eq_expression_null(self):
        expr = self.u.name == None  # noqa (Cannot override `is`)
        res = ('("res_users"."name" IS NULL)', [])
        self.assertEqual(expr.__to_sql__(), res)

    def test_ne_expression(self):
        expr = self.u.name != 'johnny'
        res = ('("res_users"."name" != %s)', ['johnny'])
        self.assertEqual(expr.__to_sql__(), res)

    def test_ne_expression_null(self):
        expr = self.u.id != None  # noqa
        res = ('("res_users"."id" IS NOT NULL)', [])
        self.assertEqual(expr.__to_sql__(), res)

    def test_and_expression(self):
        expr = (self.u.id == 5) & (self.u.name != 'johnny')
        res = ("""(("res_users"."id" = %s) AND ("res_users"."name" != %s))""", [5, 'johnny'])
        self.assertEqual(expr.__to_sql__(), res)

    def test_or_expression(self):
        expr = (self.u.id == 5) | (self.u.name != 'johnny')
        res = ("""(("res_users"."id" = %s) OR ("res_users"."name" != %s))""", [5, 'johnny'])
        self.assertEqual(expr.__to_sql__(), res)

    def test_not_expression(self):
        expr = ~(self.u.id == 5)
        res = ("""(NOT ("res_users"."id" = %s))""", [5])
        self.assertEqual(expr.__to_sql__(), res)

    def test_multi_table_expression(self):
        expr = (self.u.id != 5) & (self.p.name != None)  # noqa
        res = ("""(("res_users"."id" != %s) AND ("res_partner"."name" IS NOT NULL))""", [5])
        self.assertEqual(expr.__to_sql__(), res)

    def test_abs_expression(self):
        expr = abs(self.u.delta)
        res = ("""(ABS("res_users"."delta"))""", [])
        self.assertEqual(expr.__to_sql__(), res)


class TestSelect(common.TransactionCase):

    def setUp(self):
        self.p = Row('res_partner')
        self.u = Row('res_users')

    def test_simple_select(self):
        s = Select([self.p.id])
        res = """SELECT "res_partner"."id" FROM "res_partner\""""
        self.assertEqual(s.__to_sql__()[0], res)

    def test_select_aliased(self):
        s = Select({'id': self.p.id})
        res = """SELECT "res_partner"."id" AS id FROM "res_partner\""""
        self.assertEqual(s.__to_sql__()[0], res)

    def test_select_cartesian_product(self):
        s = Select([self.u.id, self.p.id])
        res = """SELECT "res_users"."id", "res_partner"."id" FROM "res_partner", "res_users\""""
        self.assertEqual(s.__to_sql__()[0], res)

    def test_select_simple_where(self):
        s = Select([self.p.id], self.p.id == 5)
        res = ("""SELECT "res_partner"."id" FROM "res_partner" WHERE ("res_partner"."id" = %s)""",
               [5])
        self.assertEqual(s.__to_sql__(), res)

    def test_select_complex_where(self):
        s = Select([self.p.id], (self.p.id == 5) & (self.p.active != None))  # noqa
        res = (("""SELECT "res_partner"."id" FROM "res_partner\""""
               """ WHERE (("res_partner"."id" = %s) AND ("res_partner"."active" IS NOT NULL))"""),
               [5])
        self.assertEqual(s.__to_sql__(), res)

    def test_select_right_join(self):
        self.p._nullable = True
        s = Select([self.u.id])
        s = s.join(self.u.partner_id == self.p.id)
        res = ("""SELECT "res_users"."id" FROM "res_users\""""
               """ RIGHT JOIN "res_partner" ON ("res_users"."partner_id" = "res_partner"."id")""")
        self.assertEqual(s.__to_sql__()[0], res)

    def test_select_left_join(self):
        self.p._nullable = True
        s = Select([self.p.id])
        s = s.join(self.p.id == self.u.partner_id)
        res = ("""SELECT "res_partner"."id" FROM "res_partner\""""
               """ LEFT JOIN "res_users" ON ("res_partner"."id" = "res_users"."partner_id")""")
        self.assertEqual(s.__to_sql__()[0], res)

    def test_select_full_join(self):
        self.u._nullable = True
        self.p._nullable = True
        s = Select([self.p.id])
        s = s.join(self.p.id == self.u.partner_id)
        res = ("""SELECT "res_partner"."id" FROM "res_partner\""""
               """ FULL JOIN "res_users" ON ("res_partner"."id" = "res_users"."partner_id")""")
        self.assertEqual(s.__to_sql__()[0], res)

    def test_select_inner_join(self):
        s = Select([self.p.id])
        s = s.join(self.p.id == self.u.partner_id)
        res = ("""SELECT "res_partner"."id" FROM "res_partner\""""
               """ INNER JOIN "res_users" ON ("res_partner"."id" = "res_users"."partner_id")""")
        self.assertEqual(s.__to_sql__()[0], res)

    def test_select_multi_join(self):
        self.p._nullable = True
        x = Row('res_currency', True)
        s = Select([self.p.id])
        s = s.join(self.p.id == self.u.partner_id, self.p.active == x.active)
        res = (
            """SELECT "res_partner"."id" FROM "res_partner" """
            """LEFT JOIN "res_users" ON ("res_partner"."id" = "res_users"."partner_id") """
            """FULL JOIN "res_currency" ON ("res_partner"."active" = "res_currency"."active")"""
        )
        self.assertEqual(s.__to_sql__()[0], res)

    def test_order_by_asc_nfirst(self):
        s = Select([self.p.id], order=[Asc(self.p.name, True)])
        res = (
            """SELECT "res_partner"."id" FROM "res_partner" """
            """ORDER BY "res_partner"."name" ASC NULLS FIRST"""
        )
        self.assertEqual(s.__to_sql__()[0], res)

    def test_order_by_desc_nlast(self):
        s = Select([self.p.id], order=[Desc(self.p.name)])
        res = (
            """SELECT "res_partner"."id" FROM "res_partner" """
            """ORDER BY "res_partner"."name" DESC NULLS LAST"""
        )
        self.assertEqual(s.__to_sql__()[0], res)

    def test_full_select_query(self):
        s = Select([self.p.id], where=self.p.name != 'johnny', order=[Asc(self.p.name)])
        s = s.join(self.p.id == self.u.partner_id)
        res = (
            """SELECT "res_partner"."id" FROM "res_partner" """
            """INNER JOIN "res_users" ON ("res_partner"."id" = "res_users"."partner_id") """
            """WHERE ("res_partner"."name" != %s) """
            """ORDER BY "res_partner"."name" ASC NULLS LAST""",
            ['johnny']
        )
        self.assertEqual(s.__to_sql__(), res)

    def test_distinct(self):
        s = Select([self.p.name], distinct=[self.p.name])
        res = ("""SELECT DISTINCT "res_partner"."name" FROM "res_partner\"""")
        self.assertEqual(s.__to_sql__()[0], res)

    def test_distinct_multi(self):
        s = Select([self.p.name, self.p.surname], distinct=[self.p.name, self.p.surname])
        res = ("""SELECT DISTINCT "res_partner"."name", """
               """DISTINCT "res_partner"."surname" FROM "res_partner\"""")
        self.assertEqual(s.__to_sql__()[0], res)

    def test_composite_select(self):
        s_base = Select([self.p.name, self.p.surname], where=self.p.name != 'johnny')
        s_composite = s_base.where(self.p.name == 'johnny')
        self.assertIsNot(s_base, s_composite)
        self.assertEqual(s_base._where.op, '!=')
        self.assertEqual(s_composite._where.op, '=')
