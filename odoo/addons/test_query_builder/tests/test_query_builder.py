# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests import common
from odoo.osv.query_builder import Row, Select, Asc, Desc, COALESCE


class TestExpressions(common.TransactionCase):

    def setUp(self):
        super(TestExpressions, self).setUp()
        self.p = Row('res_partner')
        self.u = Row('res_users')

    def test_eq_expression(self):
        expr = self.u.id == 5
        res = ('("res_users"."id" = %s)', [5])
        self.assertEqual(expr._to_sql(None), res)

    def test_eq_expression_null(self):
        expr = self.u.name == None  # noqa (Cannot override `is`)
        res = ('("res_users"."name" IS NULL)', [])
        self.assertEqual(expr._to_sql(None), res)

    def test_ne_expression(self):
        expr = self.u.name != 'johnny'
        res = ('("res_users"."name" != %s)', ['johnny'])
        self.assertEqual(expr._to_sql(None), res)

    def test_ne_expression_null(self):
        expr = self.u.id != None  # noqa
        res = ('("res_users"."id" IS NOT NULL)', [])
        self.assertEqual(expr._to_sql(None), res)

    def test_and_expression(self):
        expr = (self.u.id == 5) & (self.u.name != 'johnny')
        res = ("""(("res_users"."id" = %s) AND ("res_users"."name" != %s))""", [5, 'johnny'])
        self.assertEqual(expr._to_sql(None), res)

    def test_or_expression(self):
        expr = (self.u.id == 5) | (self.u.name != 'johnny')
        res = ("""(("res_users"."id" = %s) OR ("res_users"."name" != %s))""", [5, 'johnny'])
        self.assertEqual(expr._to_sql(None), res)

    def test_not_expression(self):
        expr = ~(self.u.id == 5)
        res = ("""(NOT ("res_users"."id" = %s))""", [5])
        self.assertEqual(expr._to_sql(None), res)

    def test_precedence_explicit(self):
        expr = (~((self.u.id > 5) | (self.u.id < 100))) & (self.u.name == 'johnny')
        res = ("""((NOT (("res_users"."id" > %s) OR ("res_users"."id" < %s)))"""
               """ AND ("res_users"."name" = %s))""", [5, 100, 'johnny'])
        self.assertEqual(expr._to_sql(None), res)

    def test_precedence_implicit(self):
        expr = ~(self.u.id > 5) | (self.u.id < 100) & (self.u.name == 'johnny')
        res = ("""((NOT ("res_users"."id" > %s)) OR (("res_users"."id" < %s)"""
               """ AND ("res_users"."name" = %s)))""", [5, 100, 'johnny'])
        self.assertEqual(expr._to_sql(None), res)

    def test_multi_table_expression(self):
        expr = (self.u.id != 5) & (self.p.name != None)  # noqa
        res = ("""(("res_users"."id" != %s) AND ("res_partner"."name" IS NOT NULL))""", [5])
        self.assertEqual(expr._to_sql(None), res)

    def test_func_expression(self):
        expr = (self.u.name != None) & (abs(self.u.delta)) & (self.u.id > 5)  # noqa
        res = ("""((("res_users"."name" IS NOT NULL) AND (ABS("res_users"."delta")))"""
               """ AND ("res_users"."id" > %s))""", [5])
        self.assertEqual(expr._to_sql(None), res)

    def test_single_arg_func_expression(self):
        expr = abs(self.u.delta)
        res = ("""(ABS("res_users"."delta"))""", [])
        self.assertEqual(expr._to_sql(None), res)

    def test_multi_arg_func_expression(self):
        expr = self.u.count % 100
        res = ("""(MOD("res_users"."count", %s))""", [100])
        self.assertEqual(expr._to_sql(None), res)

    def test_like_expression(self):
        expr = self.u.name @ 'johnny'
        res = ("""("res_users"."name" LIKE %s)""", ['johnny'])
        self.assertEqual(expr._to_sql(None), res)

    def test_ilike_expression(self):
        expr = self.u.name.ilike('johnny')
        res = ("""("res_users"."name" ILIKE %s)""", ['johnny'])
        self.assertEqual(expr._to_sql(None), res)

    def test_partial_func_expression(self):
        expr = COALESCE(self.u.id, 5)
        res = ("""(COALESCE("res_users"."id", %s))""", [5])
        self.assertEqual(expr._to_sql(None), res)

    def test_and_type(self):
        with self.assertRaises(AssertionError):
            self.p.id & 5

    def test_or_type(self):
        with self.assertRaises(AssertionError):
            self.p.id | 5

    def test_in_type(self):
        with self.assertRaises(AssertionError):
            self.p.id ^ None

    def test_like_type(self):
        with self.assertRaises(AssertionError):
            self.p.id @ [1, 2, 3]

    def test_ilike_type(self):
        with self.assertRaises(AssertionError):
            self.p.id.ilike([1, 2, 3])

    def test_pow_type(self):
        with self.assertRaises(AssertionError):
            self.p.count ** 'lol'

    def test_mod_type(self):
        with self.assertRaises(AssertionError):
            self.p.count % []


class TestSelect(common.TransactionCase):

    def setUp(self):
        super(TestSelect, self).setUp()
        self.p = Row('res_partner')
        self.u = Row('res_users')

    def test_simple_select(self):
        s = Select([self.p.id])
        res = """SELECT "a"."id" FROM "res_partner" "a\""""
        self.assertEqual(s.to_sql()[0], res)

    def test_select_aliased(self):
        s = Select({'id': self.p.id})
        res = """SELECT "a"."id" AS id FROM "res_partner" "a\""""
        self.assertEqual(s.to_sql()[0], res)

    def test_select_all(self):
        s = Select([self.p])
        res = """SELECT * FROM "res_partner" "a\""""
        self.assertEqual(s.to_sql()[0], res)

    def test_select_cartesian_product(self):
        s = Select([self.u.id, self.p.id])
        res = """SELECT "a"."id", "b"."id" FROM "res_users" "a", "res_partner" "b\""""
        self.assertEqual(s.to_sql()[0], res)

    def test_select_simple_where(self):
        s = Select([self.p.id], self.p.id == 5)
        res = ("""SELECT "a"."id" FROM "res_partner" "a" WHERE ("a"."id" = %s)""",
               [5])
        self.assertEqual(s.to_sql(), res)

    def test_select_complex_where(self):
        s = Select([self.p.id], (self.p.id == 5) & (self.p.active != None))  # noqa
        res = (("""SELECT "a"."id" FROM "res_partner" "a" """
               """WHERE (("a"."id" = %s) AND ("a"."active" IS NOT NULL))"""),
               [5])
        self.assertEqual(s.to_sql(), res)

    def test_select_right_join(self):
        self.p._nullable = True
        s = Select([self.u.id])
        s = s.join(self.u.partner_id == self.p.id)
        res = ("""SELECT "a"."id" FROM "res_users" "a" """
               """RIGHT JOIN "res_partner" "b" ON ("a"."partner_id" = "b"."id")""")
        self.assertEqual(s.to_sql()[0], res)

    def test_select_left_join(self):
        self.p._nullable = True
        s = Select([self.p.id])
        s = s.join(self.p.id == self.u.partner_id)
        res = ("""SELECT "a"."id" FROM "res_partner" "a" """
               """LEFT JOIN "res_users" "b" ON ("a"."id" = "b"."partner_id")""")
        self.assertEqual(s.to_sql()[0], res)

    def test_select_full_join(self):
        self.u._nullable = True
        self.p._nullable = True
        s = Select([self.p.id])
        s = s.join(self.p.id == self.u.partner_id)
        res = ("""SELECT "a"."id" FROM "res_partner" "a" """
               """FULL JOIN "res_users" "b" ON ("a"."id" = "b"."partner_id")""")
        self.assertEqual(s.to_sql()[0], res)

    def test_select_inner_join(self):
        s = Select([self.p.id])
        s = s.join(self.p.id == self.u.partner_id)
        res = ("""SELECT "a"."id" FROM "res_partner" "a" """
               """INNER JOIN "res_users" "b" ON ("a"."id" = "b"."partner_id")""")
        self.assertEqual(s.to_sql()[0], res)

    def test_select_multi_join(self):
        self.p._nullable = True
        x = Row('res_currency', True)
        s = Select([self.p.id])
        s = s.join(self.p.id == self.u.partner_id, self.p.active == x.active)
        res = (
            """SELECT "a"."id" FROM "res_partner" "a" """
            """LEFT JOIN "res_users" "b" ON ("a"."id" = "b"."partner_id") """
            """FULL JOIN "res_currency" "c" ON ("a"."active" = "c"."active")"""
        )
        self.assertEqual(s.to_sql()[0], res)

    def test_order_by_asc_nfirst(self):
        s = Select([self.p.id, self.p.name], order=[Asc(self.p.name, True)])
        res = (
            """SELECT "a"."id", "a"."name" FROM "res_partner" "a" """
            """ORDER BY "a"."name" ASC NULLS FIRST"""
        )
        self.assertEqual(s.to_sql()[0], res)

    def test_order_by_desc_nlast(self):
        s = Select([self.p.id, self.p.name], order=[Desc(self.p.name)])
        res = (
            """SELECT "a"."id", "a"."name" FROM "res_partner" "a" """
            """ORDER BY "a"."name" DESC NULLS LAST"""
        )
        self.assertEqual(s.to_sql()[0], res)

    def test_order_by_no_modifier(self):
        s = Select([self.p.id, self.p.name], order=[self.p.name])
        self.assertEqual(
            s.to_sql()[0],
            """SELECT "a"."id", "a"."name" FROM "res_partner" "a" """
            """ORDER BY "a"."name\""""
        )

    def test_full_select_query(self):
        s = Select([self.p.id], where=self.p.name != 'johnny', order=[Asc(self.p.name)])
        s = s.join(self.p.id == self.u.partner_id)
        res = (
            """SELECT "a"."id" FROM "res_partner" "a" """
            """INNER JOIN "res_users" "b" ON ("a"."id" = "b"."partner_id") """
            """WHERE ("a"."name" != %s) """
            """ORDER BY "a"."name" ASC NULLS LAST""",
            ['johnny']
        )
        self.assertEqual(s.to_sql(), res)

    def test_distinct(self):
        s = Select([self.p.name], distinct=True)
        res = ("""SELECT DISTINCT "a"."name" FROM "res_partner" "a\"""")
        self.assertEqual(s.to_sql()[0], res)

    def test_distinct_multi(self):
        s = Select([self.p.name, self.p.surname], distinct=True)
        res = ("""SELECT DISTINCT "a"."name", """
               """"a"."surname" FROM "res_partner" "a\"""")
        self.assertEqual(s.to_sql()[0], res)

    def test_composite_select(self):
        s_base = Select([self.p.name, self.p.surname], where=self.p.name != 'johnny')
        s_composite = s_base.where(self.p.name == 'johnny')
        self.assertIsNot(s_base, s_composite)
        self.assertEqual(s_base._where.op, '!=')
        self.assertEqual(s_composite._where.op, '=')

    def test_group_by(self):
        s = Select([self.p.id, self.p.name], group=[self.p.name])
        self.assertEqual(
            s.to_sql()[0],
            """SELECT "a"."id", "a"."name" FROM "res_partner" "a" """
            """GROUP BY "a"."name\""""
        )

    def test_having(self):
        s = Select([self.p.id, self.p.name], group=[self.p.name], having=self.p.name != 'johnny')
        self.assertEqual(
            s.to_sql(),
            ("""SELECT "a"."id", "a"."name" FROM "res_partner" "a" """
             """GROUP BY "a"."name" HAVING ("a"."name" != %s)""", ['johnny'])
        )

    def test_limit(self):
        s = Select([self.p.id], limit=5)
        self.assertEqual(
            s.to_sql(),
            ("""SELECT "a"."id" FROM "res_partner" "a" LIMIT %s OFFSET %s""",
             [5, 0])
        )

    def test_offset(self):
        s = Select([self.p.id], limit=7, offset=2)
        self.assertEqual(
            s.to_sql(),
            ("""SELECT "a"."id" FROM "res_partner" "a" LIMIT %s OFFSET %s""",
             [7, 2])
        )

    def test_union(self):
        s1 = Select([self.p.id])
        s2 = Select([self.u.id])
        s = s1 | s2
        self.assertEqual(
            s.to_sql(),
            ("""(SELECT "a"."id" FROM "res_partner" "a") UNION """
             """(SELECT "a"."id" FROM "res_users" "a")""", [])
        )

    def test_union_all(self):
        s1 = Select([self.p.id])
        s2 = Select([self.u.id], _all=True)
        s = s1 | s2
        self.assertEqual(
            s.to_sql(),
            ("""(SELECT "a"."id" FROM "res_partner" "a") UNION ALL """
             """(SELECT "a"."id" FROM "res_users" "a")""", [])
        )

    def test_union_with_args(self):
        s1 = Select([self.p.id], where=self.p.id > 5)
        s2 = Select([self.u.id], where=self.u.id < 5)
        s = s1 | s2
        self.assertEqual(
            s.to_sql(),
            ("""(SELECT "a"."id" FROM "res_partner" "a" WHERE ("a"."id" > %s))"""
             """ UNION """
             """(SELECT "a"."id" FROM "res_users" "a" WHERE ("a"."id" < %s))""",
             [5, 5])
        )

    def test_intersect(self):
        s1 = Select([self.p.id])
        s2 = Select([self.u.id])
        s = s1 & s2
        self.assertEqual(
            s.to_sql(),
            ("""(SELECT "a"."id" FROM "res_partner" "a") INTERSECT """
             """(SELECT "a"."id" FROM "res_users" "a")""", [])
        )

    def test_except(self):
        s1 = Select([self.p.id])
        s2 = Select([self.u.id])
        s = s1 - s2
        self.assertEqual(
            s.to_sql(),
            ("""(SELECT "a"."id" FROM "res_partner" "a") EXCEPT """
             """(SELECT "a"."id" FROM "res_users" "a")""", [])
        )

    def test_chained_select_ops(self):
        s1 = Select([self.p.id])
        s2 = Select([self.u.id])
        s3 = Select([self.p.name])
        s = s1 & s2 | s3
        self.assertEqual(
            s.to_sql(),
            (
                """((SELECT "a"."id" FROM "res_partner" "a") INTERSECT """
                """(SELECT "a"."id" FROM "res_users" "a")) UNION """
                """(SELECT "a"."name" FROM "res_partner" "a")""",
                []
            )
        )

    def test_smart_joins(self):
        s = Select([self.p.id, self.u.id], joins=[self.p.id == self.u.partner_id])
        self.assertEqual(
            s.to_sql()[0],
            """SELECT "a"."id", "b"."id" FROM "res_partner" "a" """
            """INNER JOIN "res_users" "b" ON ("a"."id" = "b"."partner_id")"""
        )

    def test_new_columns(self):
        base = Select([self.p.name])
        new = base.columns(self.p.id)
        self.assertIsNot(base, new)
        self.assertEqual(base.to_sql()[0],
                         """SELECT "a"."name" FROM "res_partner" "a\"""")
        self.assertEqual(new.to_sql()[0],
                         """SELECT "a"."id" FROM "res_partner" "a\"""")

    def test_new_distinct(self):
        base = Select([self.p.id, self.p.name], distinct=True)
        new = base.distinct()
        self.assertIsNot(base, new)
        self.assertEqual(
            base.to_sql()[0],
            """SELECT DISTINCT "a"."id", "a"."name" FROM "res_partner" "a\""""
        )
        self.assertEqual(new.to_sql()[0],
                         """SELECT "a"."id", "a"."name" FROM "res_partner" "a\"""")

    def test_new_where(self):
        base = Select([self.p.id], where=self.p.id > 5)
        new = base.where(self.p.id < 5)
        self.assertIsNot(base, new)
        self.assertEqual(
            base.to_sql(),
            ("""SELECT "a"."id" FROM "res_partner" "a" WHERE ("a"."id" > %s)""",
             [5])
        )
        self.assertEqual(
            new.to_sql(),
            ("""SELECT "a"."id" FROM "res_partner" "a" WHERE ("a"."id" < %s)""",
             [5])
        )

    def test_new_join(self):
        base = Select([self.p.id], joins=[self.p.id == self.u.partner_id])
        new = base.join(self.p.name == self.u.name)
        self.assertIsNot(base, new)
        self.assertEqual(
            base.to_sql()[0],
            """SELECT "a"."id" FROM "res_partner" "a" """
            """INNER JOIN "res_users" "b" ON ("a"."id" = "b"."partner_id")"""
        )
        self.assertEqual(
            new.to_sql()[0],
            """SELECT "a"."id" FROM "res_partner" "a" """
            """INNER JOIN "res_users" "b" ON ("a"."name" = "b"."name")"""
        )

    def test_new_order(self):
        base = Select([self.p.id, self.p.name], order=[Asc(self.p.name)])
        new = base.order(Desc(self.p.id))
        self.assertIsNot(base, new)
        self.assertEqual(
            base.to_sql()[0],
            """SELECT "a"."id", "a"."name" FROM "res_partner" "a" """
            """ORDER BY "a"."name" ASC NULLS LAST"""
        )
        self.assertEqual(
            new.to_sql()[0],
            """SELECT "a"."id", "a"."name" FROM "res_partner" "a" """
            """ORDER BY "a"."id" DESC NULLS LAST"""
        )

    def test_new_group(self):
        base = Select([self.p.id, self.p.name], group=[self.p.id])
        new = base.group(self.p.name)
        self.assertIsNot(base, new)
        self.assertEqual(
            base.to_sql()[0],
            """SELECT "a"."id", "a"."name" FROM "res_partner" "a" """
            """GROUP BY "a"."id\""""
        )
        self.assertEqual(
            new.to_sql()[0],
            """SELECT "a"."id", "a"."name" FROM "res_partner" "a" """
            """GROUP BY "a"."name\""""
        )

    def test_new_having(self):
        base = Select([self.p.id, self.p.name], group=[self.p.id], having=self.p.id > 5)
        new = base.having(self.p.name != 'johnny')
        self.assertIsNot(base, new)
        self.assertEqual(
            base.to_sql(),
            ("""SELECT "a"."id", "a"."name" FROM "res_partner" "a" """
             """GROUP BY "a"."id" HAVING ("a"."id" > %s)""", [5])
        )
        self.assertEqual(
            new.to_sql(),
            ("""SELECT "a"."id", "a"."name" FROM "res_partner" "a" """
             """GROUP BY "a"."id" HAVING ("a"."name" != %s)""", ['johnny'])
        )

    def test_new_limit(self):
        base = Select([self.p.id], limit=5)
        new = base.limit(100)
        self.assertIsNot(base, new)
        self.assertEqual(
            base.to_sql(),
            ("""SELECT "a"."id" FROM "res_partner" "a" LIMIT %s OFFSET %s""",
             [5, 0])
        )
        self.assertEqual(
            new.to_sql(),
            ("""SELECT "a"."id" FROM "res_partner" "a" LIMIT %s OFFSET %s""",
             [100, 0])
        )

    def test_new_offset(self):
        base = Select([self.p.id], limit=100, offset=50)
        new = base.offset(30)
        self.assertIsNot(base, new)
        self.assertEqual(
            base.to_sql(),
            ("""SELECT "a"."id" FROM "res_partner" "a" LIMIT %s OFFSET %s""",
             [100, 50])
        )
        self.assertEqual(
            new.to_sql(),
            ("""SELECT "a"."id" FROM "res_partner" "a" LIMIT %s OFFSET %s""",
             [100, 30])
        )

    def test_new_all(self):
        base = Select([self.p.id])
        new = base.all()
        self.assertIsNot(base, new)
        self.assertEqual(
            (new & base).to_sql()[0],
            """(SELECT "a"."id" FROM "res_partner" "a") INTERSECT """
            """(SELECT "a"."id" FROM "res_partner" "a")"""
        )
        self.assertEqual(
            (base & new).to_sql()[0],
            """(SELECT "a"."id" FROM "res_partner" "a") INTERSECT ALL """
            """(SELECT "a"."id" FROM "res_partner" "a")"""
        )

    def test_alias_multiple(self):
        c = Row('res_currency')
        d = Row('res_groups')
        s = Select([self.p.id, self.u.id, c.id, d.id])
        self.assertEqual(
            s.to_sql()[0],
            """SELECT "a"."id", "b"."id", "c"."id", "d"."id" """
            """FROM "res_partner" "a", "res_users" "b", "res_currency" "c", "res_groups" "d\""""
        )

    def test_sub_query(self):
        sub = Select([self.p.id], limit=5)
        s = Select([self.u.id], where=self.u.partner_id ^ sub)
        self.assertEqual(
            s.to_sql(),
            (
                """SELECT "a"."id" FROM "res_users" "a" """
                """WHERE ("a"."partner_id" IN (SELECT "b"."id" FROM "res_partner" "b" """
                """LIMIT %s OFFSET %s))""", [5, 0]
            )
        )
