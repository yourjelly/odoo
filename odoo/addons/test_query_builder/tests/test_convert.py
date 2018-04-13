# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests import common
from odoo.osv.query_builder import Row, Select, Column


class TestExpressions(common.TransactionCase):

    def setUp(self):
        self.p = Row('res_partner')
        self.u = Row('res_users')

    def test_eq_expression(self):
        expr = self.u.id == 5
        self.assertEqual(expr.__to_sql__(), '("res_users"."id" = 5)')

    def test_eq_expression_null(self):
        expr = self.u.name == None  # noqa (Cannot override `is`)
        self.assertEqual(expr.__to_sql__(), '("res_users"."name" IS NULL)')

    def test_ne_expression(self):
        expr = self.u.name != 'johnny'
        self.assertEqual(expr.__to_sql__(), '("res_users"."name" != \'johnny\')')

    def test_ne_expression_null(self):
        expr = self.u.id != None  # noqa
        self.assertEqual(expr.__to_sql__(), '("res_users"."id" IS NOT NULL)')

    def test_and_expression(self):
        expr = (self.u.id == 5) & (self.u.name != 'johnny')
        res = """(("res_users"."id" = 5) AND ("res_users"."name" != 'johnny'))"""
        self.assertEqual(expr.__to_sql__(), res)

    def test_or_expression(self):
        expr = (self.u.id == 5) | (self.u.nmae != 'johnny')
        res = """(("res_users"."id" = 5) OR ("res_users"."name" != 'johnny'))"""
        self.assertEqual(expr.__to_sql__(), res)

    def test_not_expression(self):
        expr = ~(self.u.id == 5)
        res = """(NOT ("res_users"."id" = 5))"""
        self.assertEqual(expr.__to_sql__(), res)

    def test_multi_table_expression(self):
        expr = (self.u.id != 5) & (self.p.name != None)  # noqa
        res = """(("res_users"."id" != 5) AND ("res_partner"."name" IS NOT NULL))"""
        self.assertEqual(expr.__to_sql__(), res)


class TestSelect(common.TransactionCase):

    def setUp(self):
        self.p = Row('res_partner')
        self.u = Row('res_users')

    def test_simple_select(self):
        s = Select([self.p.id])
        res = """SELECT "res_partner"."id" FROM "res_partner\""""
        self.assertEqual(s.build(), res)

    def test_select_aliased(self):
        s = Select({'id': self.p.id})
        res = """SELECT "res_partner"."id" AS "id" FROM "res_partner\""""
        self.assertEqual(s.build(), res)

    def test_select_cartesian_product(self):
        s = Select([self.u.id, self.p.id])
        res = """SELECT "res_users"."id", "res_partner"."id" FROM "res_users", "res_partner\""""
        self.assertEqual(s.build(), res)

    def test_select_simple_where(self):
        s = Select([self.p.id], self.p.id == 5)
        res = """SELECT "res_partner"."id" FROM "res_partner" WHERE ("res_partner"."id" = 5)"""
        self.assertEqual(s.build(), res)

    def test_select_complex_where(self):
        s = Select([self.p.id], (self.p.id == 5) & (self.p.active != None))  # noqa
        res = ("""SELECT "res_partner"."id" FROM "res_partner\""""
               """WHERE (("res_partner"."id" = 5) AND ("res_partner"."active" IS NOT NULL))""")
        self.assertEqual(s.build(), res)

    def test_select_left_join(self):
        self.p._nullable = True
        s = Select([self.u.id])
        s.join(self.u.partner_id == self.p.id)
        res = ("""SELECT "res_users"."id" FROM "res_users\""""
               """LEFT JOIN "res_partner" ON "res_users"."partner_id" = "res_partner"."id\"""")
        self.assertEqual(s.build(), res)

    def test_select_right_join(self):
        self.u._nullable = True
        s = Select([self.p.id])
        s.join(self.p.id == self.u.partner_id)
        res = ("""SELECT "res_partner"."id" FROM "res_partner\""""
               """RIGHT JOIN "res_users" ON "res_partner"."id" = "res_users"."partner_id\"""")
        self.assertEqual(s.build(), res)

    def test_select_full_join(self):
        self.u._nullable = True
        self.p._nullable = True
        s = Select([self.p.id])
        s.join(self.p.id == self.u.partner_id)
        res = ("""SELECT "res_partner"."id" FROM "res_partner\""""
               """FULL JOIN "res_users" ON "res_partner"."id" = "res_users"."partner_id\"""")
        self.assertEqual(s.build(), res)

    def test_select_outer_join(self):
        s = Select([self.p.id])
        s.join(self.p.id == self.u.partner_id)
        res = ("""SELECT "res_partner"."id" FROM "res_partner\""""
               """INNER JOIN "res_users" ON "res_partner"."id" = "res_users"."partner_id\"""")
        self.assertEqual(s.build(), res)
