# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests import common
from odoo.osv.query_builder import Row, Select, Asc, Desc


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

    def test_precedence_explicit(self):
        expr = (~((self.u.id > 5) | (self.u.id < 100))) & (self.u.name == 'johnny')
        res = ("""((NOT (("res_users"."id" > %s) OR ("res_users"."id" < %s)))"""
               """ AND ("res_users"."name" = %s))""", [5, 100, 'johnny'])
        self.assertEqual(expr.__to_sql__(), res)

    def test_precedence_implicit(self):
        expr = ~(self.u.id > 5) | (self.u.id < 100) & (self.u.name == 'johnny')
        res = ("""((NOT ("res_users"."id" > %s)) OR (("res_users"."id" < %s)"""
               """ AND ("res_users"."name" = %s)))""", [5, 100, 'johnny'])
        self.assertEqual(expr.__to_sql__(), res)

    def test_multi_table_expression(self):
        expr = (self.u.id != 5) & (self.p.name != None)  # noqa
        res = ("""(("res_users"."id" != %s) AND ("res_partner"."name" IS NOT NULL))""", [5])
        self.assertEqual(expr.__to_sql__(), res)

    def test_func_expression(self):
        expr = (self.u.name != None) & (abs(self.u.delta)) & (self.u.id > 5)  # noqa
        res = ("""((("res_users"."name" IS NOT NULL) AND (ABS("res_users"."delta")))"""
               """ AND ("res_users"."id" > %s))""", [5])
        self.assertEqual(expr.__to_sql__(), res)

    def test_single_arg_func_expression(self):
        expr = abs(self.u.delta)
        res = ("""(ABS("res_users"."delta"))""", [])
        self.assertEqual(expr.__to_sql__(), res)

    def test_multi_arg_func_expression(self):
        expr = self.u.count % 100
        res = ("""(MOD("res_users"."count", %s))""", [100])
        self.assertEqual(expr.__to_sql__(), res)

    def test_like_expression(self):
        expr = self.u.name @ 'johnny'
        res = ("""("res_users"."name" LIKE %s)""", ['johnny'])
        self.assertEqual(expr.__to_sql__(), res)

    def test_ilike_expression(self):
        expr = self.u.name.ilike('johnny')
        res = ("""("res_users"."name" ILIKE %s)""", ['johnny'])
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

    def test_select_all(self):
        s = Select([self.p])
        res = """SELECT * FROM "res_partner\""""
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
        s = Select([self.p.id, self.p.name], order=[Asc(self.p.name, True)])
        res = (
            """SELECT "res_partner"."id", "res_partner"."name" FROM "res_partner" """
            """ORDER BY "res_partner"."name" ASC NULLS FIRST"""
        )
        self.assertEqual(s.__to_sql__()[0], res)

    def test_order_by_desc_nlast(self):
        s = Select([self.p.id, self.p.name], order=[Desc(self.p.name)])
        res = (
            """SELECT "res_partner"."id", "res_partner"."name" FROM "res_partner" """
            """ORDER BY "res_partner"."name" DESC NULLS LAST"""
        )
        self.assertEqual(s.__to_sql__()[0], res)

    def test_order_by_no_modifier(self):
        s = Select([self.p.id, self.p.name], order=[self.p.name])
        self.assertEqual(
            s.__to_sql__()[0],
            """SELECT "res_partner"."id", "res_partner"."name" FROM "res_partner" """
            """ORDER BY "res_partner"."name\""""
        )

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
        s = Select([self.p.name], distinct=True)
        res = ("""SELECT DISTINCT "res_partner"."name" FROM "res_partner\"""")
        self.assertEqual(s.__to_sql__()[0], res)

    def test_distinct_multi(self):
        s = Select([self.p.name, self.p.surname], distinct=True)
        res = ("""SELECT DISTINCT "res_partner"."name", """
               """"res_partner"."surname" FROM "res_partner\"""")
        self.assertEqual(s.__to_sql__()[0], res)

    def test_composite_select(self):
        s_base = Select([self.p.name, self.p.surname], where=self.p.name != 'johnny')
        s_composite = s_base.where(self.p.name == 'johnny')
        self.assertIsNot(s_base, s_composite)
        self.assertEqual(s_base._where.op, '!=')
        self.assertEqual(s_composite._where.op, '=')

    def test_group_by(self):
        s = Select([self.p.id, self.p.name], group=[self.p.name])
        self.assertEqual(
            s.__to_sql__()[0],
            """SELECT "res_partner"."id", "res_partner"."name" FROM "res_partner" """
            """GROUP BY "res_partner"."name\""""
        )

    def test_having(self):
        s = Select([self.p.id, self.p.name], group=[self.p.name], having=self.p.name != 'johnny')
        self.assertEqual(
            s.__to_sql__(),
            ("""SELECT "res_partner"."id", "res_partner"."name" FROM "res_partner" """
             """GROUP BY "res_partner"."name" HAVING ("res_partner"."name" != %s)""", ['johnny'])
        )

    def test_limit(self):
        s = Select([self.p.id], limit=5)
        self.assertEqual(
            s.__to_sql__(),
            ("""SELECT "res_partner"."id" FROM "res_partner" LIMIT %s OFFSET %s""",
             [5, 0])
        )

    def test_offset(self):
        s = Select([self.p.id], limit=7, offset=2)
        self.assertEqual(
            s.__to_sql__(),
            ("""SELECT "res_partner"."id" FROM "res_partner" LIMIT %s OFFSET %s""",
             [7, 2])
        )

    def test_union(self):
        s1 = Select([self.p.id])
        s2 = Select([self.u.id])
        s = s1 | s2
        self.assertEqual(
            s.__to_sql__(),
            ("""(SELECT "res_partner"."id" FROM "res_partner") UNION """
             """(SELECT "res_users"."id" FROM "res_users")""", [])
        )

    def test_union_with_args(self):
        s1 = Select([self.p.id], where=self.p.id > 5)
        s2 = Select([self.u.id], where=self.u.id < 5)
        s = s1 | s2
        self.assertEqual(
            s.__to_sql__(),
            ("""(SELECT "res_partner"."id" FROM "res_partner" WHERE ("res_partner"."id" > %s))"""
             """ UNION """
             """(SELECT "res_users"."id" FROM "res_users" WHERE ("res_users"."id" < %s))""",
             [5, 5])
        )

    def test_intersect(self):
        s1 = Select([self.p.id])
        s2 = Select([self.u.id])
        s = s1 & s2
        self.assertEqual(
            s.__to_sql__(),
            ("""(SELECT "res_partner"."id" FROM "res_partner") INTERSECT """
             """(SELECT "res_users"."id" FROM "res_users")""", [])
        )

    def test_except(self):
        s1 = Select([self.p.id])
        s2 = Select([self.u.id])
        s = s1 - s2
        self.assertEqual(
            s.__to_sql__(),
            ("""(SELECT "res_partner"."id" FROM "res_partner") EXCEPT """
             """(SELECT "res_users"."id" FROM "res_users")""", [])
        )

    def test_smart_joins(self):
        s = Select([self.p.id, self.u.id], joins=[self.p.id == self.u.partner_id])
        self.assertEqual(
            s.__to_sql__()[0],
            """SELECT "res_partner"."id", "res_users"."id" FROM "res_partner" """
            """INNER JOIN "res_users" ON ("res_partner"."id" = "res_users"."partner_id")"""
        )

    #################################################
    # Test functions that return new Select instances
    #################################################

    def test_new_columns(self):
        # TODO: Verify that any of these methods properly regenerate the corresponding tables
        base = Select([self.p.name])
        new = base.columns(self.p.id)
        self.assertIsNot(base, new)
        self.assertEqual(base.__to_sql__()[0],
                         """SELECT "res_partner"."name" FROM "res_partner\"""")
        self.assertEqual(new.__to_sql__()[0],
                         """SELECT "res_partner"."id" FROM "res_partner\"""")

    def test_new_distinct(self):
        base = Select([self.p.id, self.p.name], distinct=True)
        new = base.distinct()
        self.assertIsNot(base, new)
        self.assertEqual(
            base.__to_sql__()[0],
            """SELECT DISTINCT "res_partner"."id", "res_partner"."name" FROM "res_partner\""""
        )
        self.assertEqual(new.__to_sql__()[0],
                         """SELECT "res_partner"."id", "res_partner"."name" FROM "res_partner\"""")

    def test_new_where(self):
        base = Select([self.p.id], where=self.p.id > 5)
        new = base.where(self.p.id < 5)
        self.assertIsNot(base, new)
        self.assertEqual(
            base.__to_sql__(),
            ("""SELECT "res_partner"."id" FROM "res_partner" WHERE ("res_partner"."id" > %s)""",
             [5])
        )
        self.assertEqual(
            new.__to_sql__(),
            ("""SELECT "res_partner"."id" FROM "res_partner" WHERE ("res_partner"."id" < %s)""",
             [5])
        )

    def test_new_join(self):
        base = Select([self.p.id], joins=[self.p.id == self.u.partner_id])
        new = base.join(self.p.name == self.u.name)
        self.assertIsNot(base, new)
        self.assertEqual(
            base.__to_sql__()[0],
            """SELECT "res_partner"."id" FROM "res_partner" """
            """INNER JOIN "res_users" ON ("res_partner"."id" = "res_users"."partner_id")"""
        )
        self.assertEqual(
            new.__to_sql__()[0],
            """SELECT "res_partner"."id" FROM "res_partner" """
            """INNER JOIN "res_users" ON ("res_partner"."name" = "res_users"."name")"""
        )

    def test_new_order(self):
        base = Select([self.p.id, self.p.name], order=[Asc(self.p.name)])
        new = base.order(Desc(self.p.id))
        self.assertIsNot(base, new)
        self.assertEqual(
            base.__to_sql__()[0],
            """SELECT "res_partner"."id", "res_partner"."name" FROM "res_partner" """
            """ORDER BY "res_partner"."name" ASC NULLS LAST"""
        )
        self.assertEqual(
            new.__to_sql__()[0],
            """SELECT "res_partner"."id", "res_partner"."name" FROM "res_partner" """
            """ORDER BY "res_partner"."id" DESC NULLS LAST"""
        )

    def test_new_group(self):
        base = Select([self.p.id, self.p.name], group=[self.p.id])
        new = base.group(self.p.name)
        self.assertIsNot(base, new)
        self.assertEqual(
            base.__to_sql__()[0],
            """SELECT "res_partner"."id", "res_partner"."name" FROM "res_partner" """
            """GROUP BY "res_partner"."id\""""
        )
        self.assertEqual(
            new.__to_sql__()[0],
            """SELECT "res_partner"."id", "res_partner"."name" FROM "res_partner" """
            """GROUP BY "res_partner"."name\""""
        )

    def test_new_having(self):
        base = Select([self.p.id, self.p.name], group=[self.p.id], having=self.p.id > 5)
        new = base.having(self.p.name != 'johnny')
        self.assertIsNot(base, new)
        self.assertEqual(
            base.__to_sql__(),
            ("""SELECT "res_partner"."id", "res_partner"."name" FROM "res_partner" """
             """GROUP BY "res_partner"."id" HAVING ("res_partner"."id" > %s)""", [5])
        )
        self.assertEqual(
            new.__to_sql__(),
            ("""SELECT "res_partner"."id", "res_partner"."name" FROM "res_partner" """
             """GROUP BY "res_partner"."id" HAVING ("res_partner"."name" != %s)""", ['johnny'])
        )

    def test_new_limit(self):
        base = Select([self.p.id], limit=5)
        new = base.limit(100)
        self.assertIsNot(base, new)
        self.assertEqual(
            base.__to_sql__(),
            ("""SELECT "res_partner"."id" FROM "res_partner" LIMIT %s OFFSET %s""",
             [5, 0])
        )
        self.assertEqual(
            new.__to_sql__(),
            ("""SELECT "res_partner"."id" FROM "res_partner" LIMIT %s OFFSET %s""",
             [100, 0])
        )

    def test_new_offset(self):
        base = Select([self.p.id], limit=100, offset=50)
        new = base.offset(30)
        self.assertIsNot(base, new)
        self.assertEqual(
            base.__to_sql__(),
            ("""SELECT "res_partner"."id" FROM "res_partner" LIMIT %s OFFSET %s""",
             [100, 50])
        )
        self.assertEqual(
            new.__to_sql__(),
            ("""SELECT "res_partner"."id" FROM "res_partner" LIMIT %s OFFSET %s""",
             [100, 30])
        )
