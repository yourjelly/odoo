# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from unittest import TestCase
from collections import OrderedDict
from odoo.tests.common import tagged
from odoo.tools.query import Row, Select, Delete, With, Update, Insert, \
    Asc, Desc, coalesce, unnest, NULL, DEFAULT, _quote, BaseQuery, CreateView, \
    concat, count, Join, substr, length


@tagged('standard', 'at_install')
class TestMisc(TestCase):

    def test_quote_unquoted(self):
        self.assertEqual(_quote("foo"), '"foo"')

    def test_quote_quoted(self):
        self.assertEqual(_quote('"bar"'), '"bar"')

    def test_row_dunder_getter(self):
        with self.assertRaises(AttributeError):
            Row('res_partner').__name__

    def test_build_base_not_impl(self):
        with self.assertRaises(NotImplementedError):
            BaseQuery()._build_base(None)

    def test_multiple_to_sql_calls(self):
        p = Row("res_partner")
        s = Select([p.id], where=p.id > 5, order=[p.name], distinct=True)
        first = s.to_sql()
        second = s.to_sql()
        self.assertEqual(first, second)

    def test_lots_of_args(self):
        p = Row("res_partner")
        s = Select([p.id], where=(p.id > 5) & (p.name.like('foo')) | (p.my_company == [1, 2, 3]),
                   limit=5, offset=3)
        sql, args = s.to_sql()
        self.assertEqual(args, (5, 'foo', [1, 2, 3], 5, 3))


@tagged('standard', 'at_install')
class TestExpressions(TestCase):

    def setUp(self):
        super(TestExpressions, self).setUp()
        self.p = Row('res_partner')
        self.u = Row('res_users')

    def test_base_row_property(self):
        expr = self.p.id == self.u.partner_id
        self.assertEqual(expr.rows, set([self.p, self.u]))

    def test_recursive_row_property(self):
        expr = (self.p.id == self.u.partner_id) & (self.p.count > 5)
        self.assertEqual(expr.rows, set([self.p, self.u]))

    def test_eq_expression(self):
        expr = self.u.id == 5
        res = ('("res_users"."id" = %s)', [5])
        self.assertEqual(expr._to_sql(None), res)

    def test_eq_expression_null(self):
        expr = self.u.name == NULL
        res = ('("res_users"."name" IS NULL)', [])
        self.assertEqual(expr._to_sql(None), res)

    def test_ne_expression(self):
        expr = self.u.name != 'johnny'
        res = ('("res_users"."name" != %s)', ['johnny'])
        self.assertEqual(expr._to_sql(None), res)

    def test_ne_expression_null(self):
        expr = self.u.id != NULL
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
        expr = (self.u.id != 5) & (self.p.name != NULL)
        res = ("""(("res_users"."id" != %s) AND ("res_partner"."name" IS NOT NULL))""", [5])
        self.assertEqual(expr._to_sql(None), res)

    def test_func_expression(self):
        expr = (self.u.name != NULL) & (abs(self.u.delta)) & (self.u.id > 5)
        res = ("""((("res_users"."name" IS NOT NULL) AND "abs"("res_users"."delta"))"""
               """ AND ("res_users"."id" > %s))""", [5])
        self.assertEqual(expr._to_sql(None), res)

    def test_single_arg_func_expression(self):
        expr = abs(self.u.delta)
        res = (""""abs"("res_users"."delta")""", [])
        self.assertEqual(expr._to_sql(None), res)

    def test_multi_arg_func_expression(self):
        expr = self.u.count % 100
        res = (""""mod"("res_users"."count", %s)""", [100])
        self.assertEqual(expr._to_sql(None), res)

    def test_like_expression(self):
        expr = self.u.name.like('johnny')
        res = ("""("res_users"."name" LIKE %s)""", ['johnny'])
        self.assertEqual(expr._to_sql(None), res)

    def test_ilike_expression(self):
        expr = self.u.name.ilike('johnny')
        res = ("""("res_users"."name" ILIKE %s)""", ['johnny'])
        self.assertEqual(expr._to_sql(None), res)

    def test_partial_func_expression(self):
        expr = coalesce(self.u.id, 5)
        res = (""""coalesce"("res_users"."id", %s)""", [5])
        self.assertEqual(expr._to_sql(None), res)

    def test_pow(self):
        expr = self.p.count ** 5
        res = (""""pow"("res_partner"."count", %s)""", [5])
        self.assertEqual(expr._to_sql(None), res)

    def test_and_type(self):
        with self.assertRaises(AssertionError):
            self.p.id & 5

    def test_or_type(self):
        with self.assertRaises(AssertionError):
            self.p.id | 5


@tagged('standard', 'at_install')
class TestSelect(TestCase):

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
               (5,))
        self.assertEqual(s.to_sql(), res)

    def test_select_complex_where(self):
        s = Select([self.p.id], (self.p.id == 5) & (self.p.active != NULL))
        res = (("""SELECT "a"."id" FROM "res_partner" "a" """
               """WHERE (("a"."id" = %s) AND ("a"."active" IS NOT NULL))"""),
               (5,))
        self.assertEqual(s.to_sql(), res)

    def test_select_aggregate(self):
        s = Select([count(self.p.id)])
        self.assertEqual(
            s.to_sql()[0],
            """SELECT "count"("a"."id") FROM "res_partner" "a\""""
        )

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
        s = Select([self.p.id, self.p.name], order=[Asc(self.p.name, 'first')])
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
            ('johnny',)
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

    def test_distinct_on(self):
        s = Select([self.p.name, self.p.surname], distinct=self.p.surname)
        res = ("""SELECT DISTINCT ON ("a"."surname") "a"."name", "a"."surname" """
               """FROM "res_partner" "a\"""")
        self.assertEqual(s.to_sql()[0], res)

    def test_distinct_on_multi(self):
        s = Select([self.p.name, self.p.surname], distinct=[self.p.name, self.p.surname])
        res = ("""SELECT DISTINCT ON ("a"."name", "a"."surname") "a"."name", "a"."surname" """
               """FROM "res_partner" "a\"""")
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
             """GROUP BY "a"."name" HAVING ("a"."name" != %s)""", ('johnny',))
        )

    def test_limit(self):
        s = Select([self.p.id], limit=5)
        self.assertEqual(
            s.to_sql(),
            ("""SELECT "a"."id" FROM "res_partner" "a" LIMIT %s OFFSET %s""",
             (5, 0))
        )

    def test_offset(self):
        s = Select([self.p.id], limit=7, offset=2)
        self.assertEqual(
            s.to_sql(),
            ("""SELECT "a"."id" FROM "res_partner" "a" LIMIT %s OFFSET %s""",
             (7, 2))
        )

    def test_union(self):
        s1 = Select([self.p.id])
        s2 = Select([self.u.id])
        s = s1 | s2
        self.assertEqual(
            s.to_sql(),
            ("""(SELECT "a"."id" FROM "res_partner" "a") UNION """
             """(SELECT "a"."id" FROM "res_users" "a")""", ())
        )

    def test_union_all(self):
        s1 = Select([self.p.id])
        s2 = Select([self.u.id])
        s = s1.union_all(s2)
        self.assertEqual(
            s.to_sql(),
            ("""(SELECT "a"."id" FROM "res_partner" "a") UNION ALL """
             """(SELECT "a"."id" FROM "res_users" "a")""", ())
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
             (5, 5))
        )

    def test_intersect(self):
        s1 = Select([self.p.id])
        s2 = Select([self.u.id])
        s = s1 & s2
        self.assertEqual(
            s.to_sql(),
            ("""(SELECT "a"."id" FROM "res_partner" "a") INTERSECT """
             """(SELECT "a"."id" FROM "res_users" "a")""", ())
        )

    def test_except(self):
        s1 = Select([self.p.id])
        s2 = Select([self.u.id])
        s = s1 - s2
        self.assertEqual(
            s.to_sql(),
            ("""(SELECT "a"."id" FROM "res_partner" "a") EXCEPT """
             """(SELECT "a"."id" FROM "res_users" "a")""", ())
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
                ()
            )
        )

    def test_smart_joins(self):
        s = Select([self.p.id, self.u.id], joins=[self.p.id == self.u.partner_id])
        self.assertEqual(
            s.to_sql()[0],
            """SELECT "a"."id", "b"."id" FROM "res_partner" "a" """
            """INNER JOIN "res_users" "b" ON ("a"."id" = "b"."partner_id")"""
        )

    def test_full_expr_join(self):
        s = Select([self.p.id], joins=[(self.p.id == self.u.partner_id) & (self.p.id > 5)])
        self.assertEqual(
            s.to_sql(),
            ("""SELECT "a"."id" FROM "res_partner" "a" """
             """INNER JOIN "res_users" "b" ON (("a"."id" = "b"."partner_id") AND """
             """("a"."id" > %s))""", (5,))
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
        new = base.distinct(False)
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
             (5,))
        )
        self.assertEqual(
            new.to_sql(),
            ("""SELECT "a"."id" FROM "res_partner" "a" WHERE ("a"."id" < %s)""",
             (5,))
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
             """GROUP BY "a"."id" HAVING ("a"."id" > %s)""", (5,))
        )
        self.assertEqual(
            new.to_sql(),
            ("""SELECT "a"."id", "a"."name" FROM "res_partner" "a" """
             """GROUP BY "a"."id" HAVING ("a"."name" != %s)""", ('johnny',))
        )

    def test_new_limit(self):
        base = Select([self.p.id], limit=5)
        new = base.limit(100)
        self.assertIsNot(base, new)
        self.assertEqual(
            base.to_sql(),
            ("""SELECT "a"."id" FROM "res_partner" "a" LIMIT %s OFFSET %s""",
             (5, 0))
        )
        self.assertEqual(
            new.to_sql(),
            ("""SELECT "a"."id" FROM "res_partner" "a" LIMIT %s OFFSET %s""",
             (100, 0))
        )

    def test_new_offset(self):
        base = Select([self.p.id], limit=100, offset=50)
        new = base.offset(30)
        self.assertIsNot(base, new)
        self.assertEqual(
            base.to_sql(),
            ("""SELECT "a"."id" FROM "res_partner" "a" LIMIT %s OFFSET %s""",
             (100, 50))
        )
        self.assertEqual(
            new.to_sql(),
            ("""SELECT "a"."id" FROM "res_partner" "a" LIMIT %s OFFSET %s""",
             (100, 30))
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
        s = Select([self.u.id], where=self.u.partner_id.in_(sub))
        self.assertEqual(
            s.to_sql(),
            (
                """SELECT "a"."id" FROM "res_users" "a" """
                """WHERE ("a"."partner_id" IN (SELECT "b"."id" FROM "res_partner" "b" """
                """LIMIT %s OFFSET %s))""", (5, 0)
            )
        )

    def test_nested_sub_query(self):
        p = Row("res_partner")
        s1 = Select([p.id])
        s2 = Select([self.u.id], where=self.u.partner_id.in_(s1))
        s3 = Select([self.p.id], where=self.p.id.in_(s2))
        self.assertEqual(
            s3.to_sql(),
            (
                """SELECT "a"."id" FROM "res_partner" "a" """
                """WHERE ("a"."id" IN (SELECT "b"."id" FROM "res_users" "b" """
                """WHERE ("b"."partner_id" IN (SELECT "c"."id" FROM "res_partner" "c"))))""",
                ()
            )
        )

    def test_infer_table_from_where(self):
        s = Select([self.u.id], where=self.u.partner_id == self.p.id)
        self.assertEqual(
            s.to_sql(),
            (
                """SELECT "a"."id" FROM "res_users" "a", "res_partner" "b" """
                """WHERE ("a"."partner_id" = "b"."id")""", ()
            )
        )

    def test_explicit_joins(self):
        s = Select([self.p.id], joins=[Join(self.p, self.u, self.p.id == self.u.partner_id)])
        self.assertEqual(
            s.to_sql(),
            (
                """SELECT "a"."id" FROM "res_partner" "a" INNER JOIN "res_users" "b" """
                """ON ("a"."id" = "b"."partner_id")""", ()
            )
        )

    def test_conditionless_join(self):
        s = Select([self.p.id], joins=[Join(self.p, self.u)])
        self.assertEqual(
            s.to_sql(),
            (
                """SELECT "a"."id" FROM "res_partner" "a" INNER JOIN "res_users" "b\"""",
                ()
            )
        )


@tagged('standard', 'at_install')
class TestDelete(TestCase):

    def setUp(self):
        super(TestDelete, self).setUp()
        self.p = Row('res_partner')
        self.u = Row('res_users')

    def test_delete_simple(self):
        d = Delete([self.p])
        self.assertEqual(d.to_sql(), ("""DELETE FROM "res_partner" "a\"""", ()))

    def test_delete_where(self):
        d = Delete([self.p], where=self.p.id >= 5)
        self.assertEqual(
            d.to_sql(),
            ("""DELETE FROM "res_partner" "a" WHERE ("a"."id" >= %s)""", (5,))
        )

    def test_delete_using(self):
        d = Delete([self.p], using=[self.u], where=self.p.id == self.u.partner_id)
        self.assertEqual(
            d.to_sql(),
            ("""DELETE FROM "res_partner" "a" USING "res_users" "b" """
             """WHERE ("a"."id" = "b"."partner_id")""", ())
        )

    def test_delete_returning_all(self):
        d = Delete([self.p], returning=[self.p])
        self.assertEqual(
            d.to_sql(),
            ("""DELETE FROM "res_partner" "a" RETURNING *""", ())
        )

    def test_delete_returning_cols(self):
        d = Delete([self.p], returning=[self.p.id, self.p.name])
        self.assertEqual(
            d.to_sql(),
            ("""DELETE FROM "res_partner" "a" RETURNING "a"."id", "a"."name\"""", ())
        )

    def test_delete_returning_expr(self):
        d = Delete([self.p], returning=[self.p.id <= 5])
        self.assertEqual(
            d.to_sql(),
            ("""DELETE FROM "res_partner" "a" RETURNING ("a"."id" <= %s)""", (5,))
        )

    def test_delete_new_rows(self):
        d1 = Delete([self.p])
        d2 = d1.rows(self.u)

        self.assertIsNot(d1, d2)

    def test_delete_new_using(self):
        d1 = Delete([self.p], [self.u])
        d2 = d1.using()

        self.assertIsNot(d1, d2)

    def test_delete_new_where(self):
        d1 = Delete([self.p], where=self.p.id > 5)
        d2 = d1.where(self.p.id < 5)

        self.assertIsNot(d1, d2)

    def test_delete_new_returning(self):
        d1 = Delete([self.p])
        d2 = d1.using(self.p.id)

        self.assertIsNot(d1, d2)


@tagged('standard', 'at_install')
class TestWith(TestCase):

    def setUp(self):
        self.p = Row('res_partner')
        self.u = Row('res_users')
        self.tmp_r = Row('my_temp_table')
        self.tmp_s = Select([self.u.partner_id])
        self.s = Select([self.p.id], where=self.p.id == self.tmp_r.id)

    def test_basic_with_select(self):
        with_st = With([(self.tmp_r('id'), self.tmp_s)], self.s)
        self.assertEqual(
            with_st.to_sql()[0],
            """WITH "my_temp_table"("id") AS """
            """(SELECT "a"."partner_id" FROM "res_users" "a") """
            """SELECT "b"."id" FROM "res_partner" "b" """
            """WHERE ("b"."id" = "my_temp_table"."id")"""
        )

    def test_basic_with_recursive(self):
        s = Select([self.tmp_r.id])
        with_st = With([(self.tmp_r('id'), self.tmp_s | s)], self.s, True)
        self.assertEqual(
            with_st.to_sql()[0],
            """WITH RECURSIVE "my_temp_table"("id") AS """
            """((SELECT "a"."partner_id" FROM "res_users" "a") """
            """UNION (SELECT "a"."id" FROM "my_temp_table" "a")) """
            """SELECT "b"."id" FROM "res_partner" "b" WHERE ("b"."id" = "my_temp_table"."id")"""
        )

    def test_with_select_multi_col(self):
        with_st = With([(self.tmp_r('id', 'name', 'surname'), self.tmp_s)],
                       Select([self.p.id], where=self.p.id == self.tmp_r.id))
        self.assertEqual(
            with_st.to_sql()[0],
            """WITH "my_temp_table"("id", "name", "surname") AS """
            """(SELECT "a"."partner_id" FROM "res_users" "a") """
            """SELECT "b"."id" FROM "res_partner" "b" """
            """WHERE ("b"."id" = "my_temp_table"."id")"""
        )

    def test_with_select_multi_row(self):
        other_r = Row('my_other_temp_table')
        other_s = Select([self.u.id])
        s = Select([self.p.id], where=(self.p.id == self.tmp_r.id) & (self.p.id == other_r.id))
        with_st = With([(self.tmp_r('id'), self.tmp_s), (other_r('id'), other_s)], s)
        self.assertEqual(
            with_st.to_sql()[0],
            """WITH "my_temp_table"("id") AS """
            """(SELECT "a"."partner_id" FROM "res_users" "a"), """
            """"my_other_temp_table"("id") AS """
            """(SELECT "a"."id" FROM "res_users" "a") """
            """SELECT "b"."id" FROM "res_partner" "b" """
            """WHERE (("b"."id" = "my_temp_table"."id") AND """
            """("b"."id" = "my_other_temp_table"."id"))"""
        )

    def test_with_update(self):
        u = Update({self.p.name: 'John'}, where=self.p.name == 'Administrator',
                   returning=[self.p.id])
        w = With([(self.tmp_r("id"), u)], Select([self.u.id], where=self.u.id == self.tmp_r.id))
        self.assertEqual(
            w.to_sql(),
            ("""WITH "my_temp_table"("id") AS """
             """(UPDATE "res_partner" "a" SET "name" = %s WHERE ("a"."name" = %s) """
             """RETURNING "a"."id") """
             """SELECT "b"."id" FROM "res_users" "b" WHERE ("b"."id" = "my_temp_table"."id")""",
             ('John', 'Administrator'))
        )

    def test_with_delete(self):
        d = Delete([self.u], where=self.u.id > 5, returning=[self.u.partner_id])
        w = With([(self.tmp_r("id"), d)],
                 Delete([self.p], where=self.p.id == self.tmp_r.id))
        self.assertEqual(
            w.to_sql(),
            ("""WITH "my_temp_table"("id") AS """
             """(DELETE FROM "res_users" "a" WHERE ("a"."id" > %s) RETURNING "a"."partner_id") """
             """DELETE FROM "res_partner" "b" WHERE ("b"."id" = "my_temp_table"."id")""", (5,))
        )

    def test_with_insert(self):
        i = Insert(self.u('name', 'surname'), ['John', 'Wick'],
                   returning=[self.u.name, self.u.surname])
        w = With([(self.tmp_r("name", "surname"), i)],
                 Insert(self.p('name', 'surname'), [Select([self.tmp_r])]))
        self.assertEqual(
            w.to_sql(),
            ("""WITH "my_temp_table"("name", "surname") AS """
             """(INSERT INTO "res_users"("name", "surname") VALUES (%s, %s) """
             """RETURNING "res_users"."name", "res_users"."surname") """
             """INSERT INTO "res_partner"("name", "surname") (SELECT * FROM "my_temp_table")""",
             ('John', 'Wick'))
        )


@tagged('standard', 'at_install')
class TestUpdate(TestCase):

    def setUp(self):
        super(TestUpdate, self).setUp()
        self.u = Row('res_users')
        self.p = Row('res_partner')

    def test_basic_update(self):
        u = Update({self.u.id: 5})
        self.assertEqual(
            u.to_sql(),
            ("""UPDATE "res_users" "a" SET "id" = %s""", (5,))
        )

    def test_update_with_where(self):
        u = Update({self.u.name: "dummy"}, self.u.id > 10)
        self.assertEqual(
            u.to_sql(),
            ("""UPDATE "res_users" "a" SET "name" = %s WHERE ("a"."id" > %s)""", ("dummy", 10))
        )

    def test_update_with_col(self):
        u = Update({self.u.name: self.p.name})
        self.assertEqual(
            u.to_sql(),
            ("""UPDATE "res_users" "a" SET "name" = "b"."name" FROM "res_partner" "b\"""", ())
        )

    def test_update_with_returning(self):
        u = Update({self.u.id: 5}, returning=[self.u.id])
        self.assertEqual(
            u.to_sql(),
            ("""UPDATE "res_users" "a" SET "id" = %s RETURNING "a"."id\"""", (5,))
        )

    def test_update_multiple_cols(self):
        u = Update(OrderedDict([(self.p.name, "John"), (self.p.surname, "Wick")]))
        self.assertEqual(
            u.to_sql(),
            ("""UPDATE "res_partner" "a" SET "name" = %s, "surname" = %s""",
             ("John", "Wick"))
        )

    def test_update_with_sub_select(self):
        s = Select([self.u.name], where=self.u.partner_id == self.p.id, limit=1)
        u = Update({self.p.name: s})
        self.assertEqual(
            u.to_sql(),
            ("""UPDATE "res_partner" "a" SET "name" = """
             """(SELECT "b"."name" FROM "res_users" "b", "res_partner" "a" """
             """WHERE ("b"."partner_id" = "a"."id") """
             """LIMIT %s OFFSET %s)""", (1, 0))
        )


@tagged('standard', 'at_install')
class TestInsert(TestCase):

    def setUp(self):
        super(TestInsert, self).setUp()
        self.p = Row('res_partner')
        self.u = Row('res_users')

    def test_insert_basic(self):
        i = Insert(self.p('name', 'surname', 'company'), ['hello', 'world', 'mycompany'])
        self.assertEqual(
            i.to_sql(),
            ("""INSERT INTO "res_partner"("name", "surname", "company") VALUES (%s, %s, %s)""",
             ('hello', 'world', 'mycompany'))
        )

    def test_insert_without_cols(self):
        i = Insert(self.p, ['foo', 'bar'])
        self.assertEqual(
            i.to_sql(),
            ("""INSERT INTO "res_partner" VALUES (%s, %s)""", ('foo', 'bar'))
        )

    def test_insert_sub_select(self):
        s = Select([self.p.name], limit=1)
        i = Insert(self.p('name'), [s])
        self.assertEqual(
            i.to_sql(),
            ("""INSERT INTO "res_partner"("name") """
             """(SELECT "a"."name" FROM "res_partner" "a" LIMIT %s OFFSET %s)""", (1, 0))
        )

    def test_insert_constants(self):
        i = Insert(self.p('name', 'surname', 'company'), ['foo', NULL, DEFAULT])
        self.assertEqual(
            i.to_sql(),
            ("""INSERT INTO "res_partner"("name", "surname", "company") """
             """VALUES (%s, NULL, DEFAULT)""", ('foo',))
        )

    def test_insert_on_conflict(self):
        i = Insert(self.p('name'), ['foo'], do_nothing=True)
        self.assertEqual(
            i.to_sql(),
            ("""INSERT INTO "res_partner"("name") VALUES (%s) ON CONFLICT DO NOTHING""",
             ('foo',))
        )

    def test_insert_returning(self):
        i = Insert(self.p('name'), ['foo'], returning=[self.p.id])
        self.assertEqual(
            i.to_sql(),
            ("""INSERT INTO "res_partner"("name") VALUES (%s) RETURNING "res_partner"."id\"""",
             ('foo',))
        )


@tagged('standard', 'at_install')
class TestCreateView(TestCase):

    def setUp(self):
        super(TestCreateView, self).__init__()
        self.p = Row("res_partner")
        self.t = Row("my_temp_table")
        self.g = Row("res_group")
        self.w_s = Select([self.g.name], limit=1)
        self.s = Select([self.p.id], where=self.p.name.like(self.t.name))
        self.w = With([(self.t("name"), self.w_s)], self.s)

    def test_create_basic_view(self):
        v = CreateView("my_view", self.w_s)
        self.assertEqual(
            v.to_sql(),
            ("""CREATE VIEW "my_view" AS (SELECT "a"."name" FROM "res_group" "a" """
             """LIMIT %s OFFSET %s)""", (1, 0))
        )

    def test_create_or_replace_view(self):
        v = CreateView("my_view", self.w_s, replace=True)
        self.assertEqual(
            v.to_sql(),
            ("""CREATE OR REPLACE VIEW "my_view" AS (SELECT "a"."name" FROM "res_group" "a" """
             """LIMIT %s OFFSET %s)""", (1, 0))
        )

    def test_create_view_with(self):
        v = CreateView("my_view", self.w)
        self.assertEqual(
            v.to_sql(),
            ("""CREATE VIEW "my_view" AS (WITH "my_temp_table"("name") AS """
             """(SELECT "a"."name" FROM "res_group" "a" LIMIT %s OFFSET %s) """
             """SELECT "b"."id" FROM "res_partner" "b" WHERE """
             """("b"."name" LIKE "my_temp_table"."name"))""", (1, 0))
        )


@tagged('standard', 'at_install', 'query_rwc')
class TestRealWorldCases(TestCase):

    def setUp(self):
        super(TestRealWorldCases, self).setUp()
        self.maxDiff = None
        self.p = Row("res_partner")
        self.u = Row("res_users")
        self.g = Row("res_groups")

    def test_rwc_01(self):
        # fields.py @ write
        r1 = unnest([1, 2, 3])
        r2 = unnest([5, 6, 7])
        s1 = Select([r1, r2])
        s2 = Select([self.p.id1, self.p.id2], where=self.p.id1.in_([1, 5, 4]))
        i = Insert(self.g('id1', 'id2'), [s1 - s2])

        self.assertEqual(
            i.to_sql(),
            ("""INSERT INTO "res_groups"("id1", "id2") """
             """((SELECT "a", "b" FROM "unnest"(%s) "a", "unnest"(%s) "b") """
             """EXCEPT (SELECT "a"."id1", "a"."id2" FROM "res_partner" "a" """
             """WHERE ("a"."id1" IN %s)))""", ([1, 2, 3], [5, 6, 7], [1, 5, 4]))
        )

    def test_rwc_02(self):
        # models.py @ _parent_store_compute
        r = Row('dummy')
        c = Row('__parent_store_compute')
        s1 = Select([r.id, concat(r.id, '/')], where=r.parent_id == NULL)
        s2 = Select([r.id, concat(c.parent_path, r.id, '/')], where=r.parent_id == c.id)
        u = Update({r.parent_path: c.parent_path}, where=r.id == c.id)
        w = With([(c('id', 'parent_path'), s1 | s2)], u, True)

        res = ("""WITH RECURSIVE "__parent_store_compute"("id", "parent_path") AS ("""
               """(SELECT "a"."id", "concat"("a"."id", %s) """
               """FROM "dummy" "a" """
               """WHERE ("a"."parent_id" IS NULL)) """
               """UNION ("""
               """SELECT "a"."id", """
               """"concat"("b"."parent_path", "a"."id", %s) """
               """FROM "dummy" "a", "__parent_store_compute" "b" """
               """WHERE ("a"."parent_id" = "b"."id"))) """
               """UPDATE "dummy" "a" """
               """SET "parent_path" = "__parent_store_compute"."parent_path" """
               """FROM "__parent_store_compute" """
               """WHERE ("a"."id" = "__parent_store_compute"."id")""", ('/', '/'))

        self.assertEqual(w.to_sql(), res)

    def test_rwc_03(self):
        # models.py @ _table_has_rows
        s = Select([(self.p, 1)], limit=1)
        self.assertEqual(
            s.to_sql(),
            ("""SELECT %s FROM "res_partner" "a" LIMIT %s OFFSET %s""", (1, 1, 0))
        )

    def test_rwc_04(self):
        # models.py @ _parent_store_create
        r = Row('dummy')
        parent_val = 5
        ids = (1, 5, 7, 8)
        s = Select([r.parent_path], where=r.id == parent_val)
        u = Update({r.parent_path: concat(s, r.id, '/')}, where=r.id.in_(ids))

        self.assertEqual(
            u.to_sql(),
            (
                """UPDATE "dummy" "a" SET "parent_path" = ("concat"("""
                """(SELECT "a"."parent_path" FROM "dummy" "a" WHERE ("a"."id" = %s)), """
                """"a"."id", %s)) WHERE ("a"."id" IN %s)""",
                (parent_val, '/', ids)
            )
        )

    def test_rwc_05(self):
        # models.py @ _parent_store_update
        r1 = Row('child')
        r2 = Row('node')
        ids = (1, 3, 4)
        u = Update(
            {
                r1.parent_path: concat(
                    'prefix',
                    substr(
                        r1.parent_path,
                        length(r2.parent_path) - length(r2.id) + 1
                    )
                )
            },
            where=(r2.id.in_(ids)) & (r1.parent_path.like(concat(r2.parent_path, '%%'))),
            returning=[r1.id]
        )

        self.assertEqual(
            u.to_sql(),
            (
                """UPDATE "child" "a" """
                """SET "parent_path" = ("concat"(%s, "substr"("a"."parent_path", """
                """(("length"("b"."parent_path") - "length"("b"."id")) + %s)))) """
                """FROM "node" "b" """
                """WHERE (("b"."id" IN %s) AND ("a"."parent_path" """
                """LIKE "concat"("b"."parent_path", %s))) """
                """RETURNING "a"."id\"""", ('prefix', 1, ids, '%%')
            )
        )
