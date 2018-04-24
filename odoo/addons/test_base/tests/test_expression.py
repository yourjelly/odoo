# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import psycopg2

from odoo.models import BaseModel
from odoo.tests.common import TransactionCase
from odoo.tools import mute_logger
from odoo.osv import expression


class TestExpression(TransactionCase):

    def test_00_in_not_in_m2m(self):
        # Create 4 test_base record with no test_many2many, or one or two many2many.
        TestMany2many = self.env['test.many2many']
        m2m_a = TestMany2many.create({'name': 'test_expression_m2m_A'})
        m2m_b = TestMany2many.create({'name': 'test_expression_m2m_B'})

        TestBase = self.env['test.base']
        a = TestBase.create({'name': 'test_expression_test_base_A', 'many2many_ids': [(6, 0, [m2m_a.id])]})
        b = TestBase.create({'name': 'test_expression_test_base_B', 'many2many_ids': [(6, 0, [m2m_b.id])]})
        ab = TestBase.create({'name': 'test_expression_test_base_AB', 'many2many_ids': [(6, 0, [m2m_a.id, m2m_b.id])]})
        c = TestBase.create({'name': 'test_expression_test_base_C'})

        # The tests.

        # On a one2many or many2many field, `in` should be read `contains` (and
        # `not in` should be read `doesn't contain`.

        with_a = TestBase.search([('many2many_ids', 'in', [m2m_a.id])])
        self.assertEqual(a + ab, with_a, "Search for many2many_ids in m2m_a failed.")

        with_b = TestBase.search([('many2many_ids', 'in', [m2m_b.id])])
        self.assertEqual(b + ab, with_b, "Search for many2many_ids in m2m_b failed.")

        # Test base with the many2many A or the many2many B.
        with_a_or_b = TestBase.search([('many2many_ids', 'in', [m2m_a.id, m2m_b.id])])
        self.assertEqual(a + b + ab, with_a_or_b, "Search for many2many_ids contains m2m_a or m2m_b failed.")

        # Show that `contains list` is really `contains element or contains element`.
        with_a_or_with_b = TestBase.search(['|', ('many2many_ids', 'in', [m2m_a.id]), ('many2many_ids', 'in', [m2m_b.id])])
        self.assertEqual(a + b + ab, with_a_or_with_b, "Search for many2many_ids contains m2m_a or contains m2m_b failed.")

        # If we change the OR in AND...
        with_a_and_b = TestBase.search([('many2many_ids', 'in', [m2m_a.id]), ('many2many_ids', 'in', [m2m_b.id])])
        self.assertEqual(ab, with_a_and_b, "Search for many2many_ids contains m2m_a and m2m_b failed.")

        # Test base without many2many A and without many2many B.
        without_a_or_b = TestBase.search([('many2many_ids', 'not in', [m2m_a.id, m2m_b.id])])
        self.assertFalse(without_a_or_b & (a + b + ab), "Search for many2many_ids doesn't contain m2m_a or m2m_b failed (1).")
        self.assertTrue(c in without_a_or_b, "Search for many2many_ids doesn't contain m2m_a or m2m_b failed (2).")

        # Show that `doesn't contain list` is really `doesn't contain element and doesn't contain element`.
        without_a_and_without_b = TestBase.search([('many2many_ids', 'not in', [m2m_a.id]), ('many2many_ids', 'not in', [m2m_b.id])])
        self.assertFalse(without_a_and_without_b & (a + b + ab), "Search for many2many_ids doesn't contain m2m_a and m2m_b failed (1).")
        self.assertTrue(c in without_a_and_without_b, "Search for many2many_ids doesn't contain m2m_a and m2m_b failed (2).")

        # We can exclude any test_base containing the category A.
        without_a = TestBase.search([('many2many_ids', 'not in', [m2m_a.id])])
        self.assertTrue(a not in without_a, "Search for many2many_ids doesn't contain m2m_a failed (1).")
        self.assertTrue(ab not in without_a, "Search for many2many_ids doesn't contain m2m_a failed (2).")
        self.assertLessEqual(b + c, without_a, "Search for many2many_ids doesn't contain m2m_a failed (3).")

        # (Obviously we can do the same for cateory B.)
        without_b = TestBase.search([('many2many_ids', 'not in', [m2m_b.id])])
        self.assertTrue(b not in without_b, "Search for many2many_ids doesn't contain m2m_b failed (1).")
        self.assertTrue(ab not in without_b, "Search for many2many_ids doesn't contain m2m_b failed (2).")
        self.assertLessEqual(a + c, without_b, "Search for many2many_ids doesn't contain m2m_b failed (3).")

    def test_05_not_str_m2m(self):
        TestBase = self.env['test.base']
        TestMany2many = self.env['test.many2many']

        m2m_ids = {}
        for name in 'A B AB'.split():
            m2m_ids[name] = TestMany2many.create({'name': name}).id

        test_bases_config = {
            '0': [],
            'a': [m2m_ids['A']],
            'b': [m2m_ids['B']],
            'ab': [m2m_ids['AB']],
            'a b': [m2m_ids['A'], m2m_ids['B']],
            'b ab': [m2m_ids['B'], m2m_ids['AB']],
        }
        test_base_ids = {}
        for name, m2m_ids in test_bases_config.items():
            test_base_ids[name] = TestBase.create({'name': name, 'many2many_ids': [(6, 0, m2m_ids)]}).id

        base_domain = [('id', 'in', list(test_base_ids.values()))]

        def test(op, value, expected):
            found_ids = TestBase.search(base_domain + [('many2many_ids', op, value)]).ids
            expected_ids = [test_base_ids[name] for name in expected]
            self.assertItemsEqual(found_ids, expected_ids, '%s %r should return %r' % (op, value, expected))

        test('=', 'A', ['a', 'a b'])
        test('!=', 'B', ['0', 'a', 'ab'])
        test('like', 'A', ['a', 'ab', 'a b', 'b ab'])
        test('not ilike', 'B', ['0', 'a'])
        test('not like', 'AB', ['0', 'a', 'b', 'a b'])

    def test_10_hierarchy_in_m2m(self):
        TestBase = self.env['test.base']
        TestMany2many = self.env['test.many2many']

        # search through m2m relation
        test_bases = TestBase.search([('many2many_ids', 'child_of', self.ref('test_base.test_many2many_demo'))])
        self.assertTrue(test_bases)

        # setup test m2m
        m2m_root = TestMany2many.create({'name': 'Root M2M'})
        m2m_0 = TestMany2many.create({'name': 'Parent M2M', 'parent_id': m2m_root.id})
        m2m_1 = TestMany2many.create({'name': 'Child1', 'parent_id': m2m_0.id})

        # test hierarchical search in m2m with child id (list of ids)
        m2ms = TestMany2many.search([('id', 'child_of', m2m_root.ids)])
        self.assertEqual(len(m2ms), 3)

        # test hierarchical search in m2m with child id (single id)
        m2ms = TestMany2many.search([('id', 'child_of', m2m_root.id)])
        self.assertEqual(len(m2ms), 3)

        # test hierarchical search in m2m with child ids
        m2ms = TestMany2many.search([('id', 'child_of', (m2m_0 + m2m_1).ids)])
        self.assertEqual(len(m2ms), 2)

        # test hierarchical search in m2m with child ids
        m2ms = TestMany2many.search([('id', 'child_of', m2m_0.ids)])
        self.assertEqual(len(m2ms), 2)

        # test hierarchical search in m2m with child ids
        m2ms = TestMany2many.search([('id', 'child_of', m2m_1.ids)])
        self.assertEqual(len(m2ms), 1)

        # test hierarchical search in m2m with parent id (list of ids)
        m2ms = TestMany2many.search([('id', 'parent_of', m2m_1.ids)])
        self.assertEqual(len(m2ms), 3)

        # test hierarchical search in m2m with parent id (single id)
        m2ms = TestMany2many.search([('id', 'parent_of', m2m_1.id)])
        self.assertEqual(len(m2ms), 3)

        # test hierarchical search in m2m with parent ids
        m2ms = TestMany2many.search([('id', 'parent_of', (m2m_root + m2m_0).ids)])
        self.assertEqual(len(m2ms), 2)

        # test hierarchical search in m2m with parent ids
        m2ms = TestMany2many.search([('id', 'parent_of', m2m_0.ids)])
        self.assertEqual(len(m2ms), 2)

        # test hierarchical search in m2m with parent ids
        m2ms = TestMany2many.search([('id', 'parent_of', m2m_root.ids)])
        self.assertEqual(len(m2ms), 1)

    def test_10_equivalent_id(self):
        # equivalent queries
        TestBase = self.env['test.base']
        non_test_base_id = max(TestBase.search([]).ids) + 1003
        test_bases_0 = TestBase.search([])
        test_bases_1 = TestBase.search([('name', 'not like', 'probably_unexisting_name')])
        self.assertEqual(test_bases_0, test_bases_1)
        test_bases_2 = TestBase.search([('id', 'not in', [non_test_base_id])])
        self.assertEqual(test_bases_0, test_bases_2)
        test_bases_3 = TestBase.search([('id', 'not in', [])])
        self.assertEqual(test_bases_0, test_bases_3)
        test_bases_4 = TestBase.search([('id', '!=', False)])
        self.assertEqual(test_bases_0, test_bases_4)

        # equivalent queries, integer and string
        all_test_bases = TestBase.search([])
        self.assertTrue(len(all_test_bases) > 1)
        one = all_test_bases[0]
        others = all_test_bases[1:]

        test_bases_1 = TestBase.search([('id', '=', one.id)])
        self.assertEqual(one, test_bases_1)
        # TestBase.search([('id', '!=', others)]) # not permitted
        test_bases_2 = TestBase.search([('id', 'not in', others.ids)])
        self.assertEqual(one, test_bases_2)
        test_bases_3 = TestBase.search(['!', ('id', '!=', one.id)])
        self.assertEqual(one, test_bases_3)
        test_bases_4 = TestBase.search(['!', ('id', 'in', others.ids)])
        self.assertEqual(one, test_bases_4)
        # res_5 = Partner.search([('id', 'in', one)]) # TODO make it permitted, just like for child_of
        # self.assertEqual(one, res_5)
        test_bases_6 = TestBase.search([('id', 'in', [one.id])])
        self.assertEqual(one, test_bases_6)
        test_bases_7 = TestBase.search([('name', '=', one.name)])
        self.assertEqual(one, test_bases_7)
        test_bases_8 = TestBase.search([('name', 'in', [one.name])])
        # res_9 = Partner.search([('name', 'in', one.name)]) # TODO

    def test_15_m2o(self):
        TestBase = self.env['test.base']

        # testing equality with name
        test_bases = TestBase.search([('parent_id', '=', 'Parent1')])
        self.assertTrue(test_bases)

        # testing the in operator with name
        test_bases = TestBase.search([('parent_id', 'in', 'Parent1')])
        self.assertTrue(test_bases)

        # testing the in operator with a list of names
        test_bases = TestBase.search([('parent_id', 'in', ['Parent1', 'Parent2'])])
        self.assertTrue(test_bases)

        # check if many2one works with empty search list
        test_bases = TestBase.search([('many2one_id', 'in', [])])
        self.assertFalse(test_bases)

        # create new many2one with test_bases, and test_bases with no many2one
        test_many2one_2 = self.env['test.many2one'].create({'name': 'Acme 2'})
        for i in range(4):
            TestBase.create({'name': 'P of Acme %s' % i, 'many2one_id': test_many2one_2.id})
            TestBase.create({'name': 'P of All %s' % i, 'many2one_id': False})

        # check if many2one works with negative empty list
        all_test_bases = TestBase.search([])
        test_bases = TestBase.search(['|', ('many2one_id', 'not in', []), ('many2one_id', '=', False)])
        self.assertEqual(all_test_bases, test_bases, "not in [] fails")

        # check that many2one will pick the correct records with a list
        test_bases = TestBase.search([('many2one_id', 'in', [False])])
        self.assertTrue(len(test_bases) >= 4, "We should have at least 4 test base records with no many2one")

        # check that many2one will exclude the correct records with a list
        test_bases = TestBase.search([('many2one_id', 'not in', [1])])
        self.assertTrue(len(test_bases) >= 4, "We should have at least 4 test base records not related to many2one #1")

        # check that many2one will exclude the correct records with a list and False
        test_bases = TestBase.search(['|', ('many2one_id', 'not in', [1]),
                                        ('many2one_id', '=', False)])
        self.assertTrue(len(test_bases) >= 8, "We should have at least 8 test base records not related to many2one #1")

        # check that multi-level expressions also work
        test_bases = TestBase.search([('many2one_id.sub_many2one_id', 'in', [])])
        self.assertFalse(test_bases)

        # check multi-level expressions with magic columns
        test_bases = TestBase.search([('create_uid.active', '=', True)])

        # check that multi-level expressions with negative op work
        all_test_bases = TestBase.search([('many2one_id', '!=', False)])
        test_bases = TestBase.search([('many2one_id.sub_many2one_id', 'not in', [])])
        self.assertEqual(all_test_bases, test_bases, "not in [] fails")

        # Test the '(not) like/in' behavior. test.base and its parent_id
        # column are used because parent_id is a many2one, allowing to test the
        # Null value, and there are actually some null and non-null values in
        # the demo data.
        all_test_bases = TestBase.search([])
        non_test_base = max(all_test_bases.ids) + 1

        with_parent = all_test_bases.filtered(lambda p: p.parent_id)
        without_parent = all_test_bases.filtered(lambda p: not p.parent_id)
        with_name = all_test_bases.filtered(lambda p: p.name)

        # We treat null values differently than in SQL. For instance in SQL:
        #   SELECT id FROM test_base WHERE parent_id NOT IN (0)
        # will return only the records with non-null parent_id.
        #   SELECT id FROM test_base WHERE parent_id IN (0)
        # will return expectedly nothing (our ids always begin at 1).
        # This means the union of those two results will give only some
        # records, but not all present in database.
        #
        # When using domains and the ORM's search method, we think it is
        # more intuitive that the union returns all the records, and that
        # a domain like ('parent_id', 'not in', [0]) will return all
        # the records. For instance, if you perform a search for the companies
        # that don't have OpenERP has a parent company, you expect to find,
        # among others, the companies that don't have parent company.
        #

        # existing values be treated similarly if we simply check that some
        # existing value belongs to them.
        test_bases_0 = TestBase.search([('parent_id', 'not like', 'probably_unexisting_name')]) # get all rows, included null parent_id
        self.assertEqual(test_bases_0, all_test_bases)
        test_bases_1 = TestBase.search([('parent_id', 'not in', [non_test_base])]) # get all rows, included null parent_id
        self.assertEqual(test_bases_1, all_test_bases)
        test_bases_2 = TestBase.search([('parent_id', '!=', False)]) # get rows with not null parent_id, deprecated syntax
        self.assertEqual(test_bases_2, with_parent)
        test_bases_3 = TestBase.search([('parent_id', 'not in', [])]) # get all rows, included null parent_id
        self.assertEqual(test_bases_3, all_test_bases)
        test_bases_4 = TestBase.search([('parent_id', 'not in', [False])]) # get rows with not null parent_id
        self.assertEqual(test_bases_4, with_parent)
        test_bases_4b = TestBase.search([('parent_id', 'not ilike', '')]) # get only rows without parent
        self.assertEqual(test_bases_4b, without_parent)

        # The results of these queries, when combined with queries 0..4 must
        # give the whole set of ids.
        test_bases_5 = TestBase.search([('parent_id', 'like', 'probably_unexisting_name')])
        self.assertFalse(test_bases_5)
        test_bases_6 = TestBase.search([('parent_id', 'in', [non_test_base])])
        self.assertFalse(test_bases_6)
        test_bases_7 = TestBase.search([('parent_id', '=', False)])
        self.assertEqual(test_bases_7, without_parent)
        test_bases_8 = TestBase.search([('parent_id', 'in', [])])
        self.assertFalse(test_bases_8)
        test_bases_9 = TestBase.search([('parent_id', 'in', [False])])
        self.assertEqual(test_bases_9, without_parent)
        test_bases_9b = TestBase.search([('parent_id', 'ilike', '')]) # get those with a parent
        self.assertEqual(test_bases_9b, with_parent)

        # These queries must return exactly the results than the queries 0..4,
        # i.e. not ... in ... must be the same as ... not in ... .
        test_bases_10 = TestBase.search(['!', ('parent_id', 'like', 'probably_unexisting_name')])
        self.assertEqual(test_bases_0, test_bases_10)
        test_bases_11 = TestBase.search(['!', ('parent_id', 'in', [non_test_base])])
        self.assertEqual(test_bases_1, test_bases_11)
        test_bases_12 = TestBase.search(['!', ('parent_id', '=', False)])
        self.assertEqual(test_bases_2, test_bases_12)
        test_bases_13 = TestBase.search(['!', ('parent_id', 'in', [])])
        self.assertEqual(test_bases_3, test_bases_13)
        test_bases_14 = TestBase.search(['!', ('parent_id', 'in', [False])])
        self.assertEqual(test_bases_4, test_bases_14)

        # Testing many2one field is not enough, a regular char field is tested
        test_bases_15 = TestBase.search([('name', 'in', [])])
        self.assertFalse(test_bases_15)
        test_bases_16 = TestBase.search([('name', 'not in', [])])
        self.assertEqual(test_bases_16, all_test_bases)
        test_bases_17 = TestBase.search([('name', '!=', False)])
        self.assertEqual(test_bases_17, with_name)

        # check behavior for required many2one fields: sub_many2one_id is required
        test_many2one = self.env['test.many2one'].search([])
        test_many2one_101 = test_many2one.search([('sub_many2one_id', 'not ilike', '')]) # get no test many2one
        self.assertFalse(test_many2one_101)
        test_many2one_102 = test_many2one.search([('sub_many2one_id', 'ilike', '')]) # get all test many2one
        self.assertEqual(test_many2one_102, test_many2one)

    def test_in_operator(self):
        """ check that we can use the 'in' operator for plain fields """
        menus = self.env['ir.ui.menu'].search([('sequence', 'in', [1, 2, 10, 20])])
        self.assertTrue(menus)

    def test_15_o2m(self):
        TestBase = self.env['test.base']

        # test one2many operator with empty search list
        test_bases = TestBase.search([('child_ids', 'in', [])])
        self.assertFalse(test_bases)

        # test one2many operator with False
        test_bases = TestBase.search([('child_ids', '=', False)])
        for test_base in test_bases:
            self.assertFalse(test_base.child_ids)

        # verify domain evaluation for one2many != False and one2many == False
        test_bases = TestBase.search([])
        parents = TestBase.search([('child_ids', '!=', False)])
        self.assertEqual(parents, test_bases.filtered(lambda c: c.child_ids))
        leafs = TestBase.search([('child_ids', '=', False)])
        self.assertEqual(leafs, test_bases.filtered(lambda c: not c.child_ids))

        # test many2many operator with empty search list
        test_bases = TestBase.search([('many2many_ids', 'in', [])])
        self.assertFalse(test_bases)

        # test many2many operator with False
        test_bases = TestBase.search([('many2many_ids', '=', False)])
        for test_base in test_bases:
            self.assertFalse(test_base.many2many_ids)

        # filtering on nonexistent value across x2many should return nothing
        test_bases = TestBase.search([('child_ids.name', '=', 'foo')])
        self.assertFalse(test_bases)

    def test_15_equivalent_one2many_1(self):
        TestBase = self.env['test.base']
        test_base3 = TestBase.create({'name': 'Acme 3'})
        test_base4 = TestBase.create({'name': 'Acme 4', 'parent_id': test_base3.id})

        # one2many towards same model
        test_base_1 = TestBase.search([('child_ids', 'in', test_base3.child_ids.ids)]) # any company having a child of company3 as child
        self.assertEqual(test_base_1, test_base3)
        test_base_2 = TestBase.search([('child_ids', 'in', test_base3.child_ids[0].ids)]) # any company having the first child of company3 as child
        self.assertEqual(test_base_2, test_base3)

        # child_of x returns x and its children (direct or not).
        expected = test_base3 + test_base4
        test_base_1 = TestBase.search([('id', 'child_of', [test_base3.id])])
        self.assertEqual(test_base_1, expected)
        test_base_2 = TestBase.search([('id', 'child_of', test_base3.id)])
        self.assertEqual(test_base_2, expected)
        test_base_3 = TestBase.search([('id', 'child_of', [test_base3.name])])
        self.assertEqual(test_base_3, expected)
        test_base_4 = TestBase.search([('id', 'child_of', test_base3.name)])
        self.assertEqual(test_base_4, expected)

        # parent_of x returns x and its parents (direct or not).
        expected = test_base3 + test_base4
        test_base_1 = TestBase.search([('id', 'parent_of', [test_base4.id])])
        self.assertEqual(test_base_1, expected)
        test_base_2 = TestBase.search([('id', 'parent_of', test_base4.id)])
        self.assertEqual(test_base_2, expected)
        test_base_3 = TestBase.search([('id', 'parent_of', [test_base4.name])])
        self.assertEqual(test_base_3, expected)
        test_base_4 = TestBase.search([('id', 'parent_of', test_base4.name)])
        self.assertEqual(test_base_4, expected)

        # try testing real subsets with IN/NOT IN
        TestOne2many = self.env['test.one2many']
        test_base1 = TestBase.create({'name':"Dédé Boitaclou"}).id
        test_base2, _ = TestBase.name_create("Raoulette Pizza O'poil")
        o2ma = TestOne2many.create({'login': 'dbo', 'test_base_id': test_base1}).id
        o2mb = TestOne2many.create({'login': 'dbo2', 'test_base_id': test_base1}).id
        o2m2 = TestOne2many.create({'login': 'rpo', 'test_base_id': test_base2}).id
        self.assertEqual([test_base1], TestBase.search([('one2many_ids', 'in', o2ma)]).ids, "o2m IN accept single int on right side")
        self.assertEqual([test_base1], TestBase.search([('one2many_ids', 'ilike', 'Dédé Boitaclou')]).ids, "o2m NOT IN matches none on the right side")
        self.assertEqual([], TestBase.search([('one2many_ids', 'in', [10000])]).ids, "o2m NOT IN matches none on the right side")
        self.assertEqual([test_base1, test_base2], TestBase.search([('one2many_ids', 'in', [o2ma,o2m2])]).ids, "o2m IN matches any on the right side")
        all_ids = TestBase.search([]).ids
        self.assertEqual(set(all_ids) - set([test_base1]), set(TestBase.search([('one2many_ids', 'not in', o2ma)]).ids), "o2m NOT IN matches none on the right side")
        self.assertEqual(set(all_ids) - set([test_base1]), set(TestBase.search([('one2many_ids', 'not like', 'Dédé Boitaclou')]).ids), "o2m NOT IN matches none on the right side")
        self.assertEqual(set(all_ids) - set([test_base1, test_base2]), set(TestBase.search([('one2many_ids', 'not in', [o2mb, o2m2])]).ids), "o2m NOT IN matches none on the right side")

    def test_15_equivalent_one2many_2(self):
        TestBase = self.env['test.base']
        TestOne2many = self.env['test.one2many']

        # create a TestBase and a Test One2many
        test_base = TestBase.create({'name': 'ZZZ'})
        o2m = TestOne2many.create({'login': 'O2M ZZZ', 'test_base_id': test_base.id})
        non_o2m_id = o2m.id + 1000
        default_test_base = TestBase.browse(1)

        # search the TestBase via its rates one2many (the one2many must point back at the TestBase)
        o2m1 = TestOne2many.search([('name', 'not like', 'probably_unexisting_name')])
        o2m2 = TestOne2many.search([('id', 'not in', [non_o2m_id])])
        self.assertEqual(o2m1, o2m2)
        o2m3 = TestOne2many.search([('id', 'not in', [])])
        self.assertEqual(o2m1, o2m3)

        # one2many towards another model
        test_base_1 = TestBase.search([('one2many_ids', 'in', default_test_base.one2many_ids.ids)]) # TestBase having a o2m value of default test base
        self.assertEqual(test_base_1, default_test_base)
        test_base_2 = TestBase.search([('one2many_ids', 'in', default_test_base.one2many_ids[0].ids)]) # TestBase having first o2m value of default test base
        self.assertEqual(test_base_2, default_test_base)
        test_base_3 = TestBase.search([('one2many_ids', 'in', default_test_base.one2many_ids[0].id)]) # TestBase having first o2m value of default test base
        self.assertEqual(test_base_3, default_test_base)

        test_base_4 = TestBase.search([('one2many_ids', 'like', 'probably_unexisting_name')])
        self.assertFalse(test_base_4)
        # Currency.search([('rate_ids', 'unexisting_op', 'probably_unexisting_name')]) # TODO expected exception

        # get the currencies referenced by some currency rates using a weird negative domain
        test_base_5 = TestBase.search([('one2many_ids', 'not like', 'probably_unexisting_name')])
        test_base_6 = TestBase.search([('one2many_ids', 'not in', [non_o2m_id])])
        self.assertEqual(test_base_5, test_base_6)
        test_base_7 = TestBase.search([('one2many_ids', '!=', False)])
        self.assertEqual(test_base_5, test_base_7)
        test_base_8 = TestBase.search([('one2many_ids', 'not in', [])])
        self.assertEqual(test_base_5, test_base_8)

    def test_20_expression_parse(self):
        # TDE note: those tests have been added when refactoring the expression.parse() method.
        # They come in addition to the already existing tests; maybe some tests
        # will be a bit redundant
        TestOne2many = self.env['test.one2many']

        # Create users
        a = TestOne2many.create({'name': 'test_A', 'login': 'test_A'})
        b1 = TestOne2many.create({'name': 'test_B', 'login': 'test_B'})
        b2 = TestOne2many.create({'name': 'test_B2', 'login': 'test_B2', 'parent_id': b1.test_base_id.id})

        # Test1: simple inheritance
        o2ms = TestOne2many.search([('name', 'like', 'test')])
        self.assertEqual(o2ms, a + b1 + b2, 'searching through inheritance failed')
        o2ms = TestOne2many.search([('name', '=', 'test_B')])
        self.assertEqual(o2ms, b1, 'searching through inheritance failed')

        # Test2: inheritance + relational fields
        o2ms = TestOne2many.search([('child_ids.name', 'like', 'test_B')])
        self.assertEqual(o2ms, b1, 'searching through inheritance failed')

        # Special =? operator mean "is equal if right is set, otherwise always True"
        o2ms = TestOne2many.search([('name', 'like', 'test'), ('parent_id', '=?', False)])
        self.assertEqual(o2ms, a + b1 + b2, '(x =? False) failed')
        o2ms = TestOne2many.search([('name', 'like', 'test'), ('parent_id', '=?', b1.test_base_id.id)])
        self.assertEqual(o2ms, b2, '(x =? id) failed')

    def test_30_normalize_domain(self):
        norm_domain = domain = ['&', (1, '=', 1), ('a', '=', 'b')]
        self.assertEqual(norm_domain, expression.normalize_domain(domain), "Normalized domains should be left untouched")
        domain = [('x', 'in', ['y', 'z']), ('a.v', '=', 'e'), '|', '|', ('a', '=', 'b'), '!', ('c', '>', 'd'), ('e', '!=', 'f'), ('g', '=', 'h')]
        norm_domain = ['&', '&', '&'] + domain
        self.assertEqual(norm_domain, expression.normalize_domain(domain), "Non-normalized domains should be properly normalized")

    def test_40_negating_long_expression(self):
        source = ['!', '&', ('user_id', '=', 4), ('test_base_id', 'in', [1, 2])]
        expect = ['|', ('user_id', '!=', 4), ('test_base_id', 'not in', [1, 2])]
        self.assertEqual(expression.distribute_not(source), expect,
            "distribute_not on expression applied wrongly")

        pos_leaves = [[('a', 'in', [])], [('d', '!=', 3)]]
        neg_leaves = [[('a', 'not in', [])], [('d', '=', 3)]]

        source = expression.OR([expression.AND(pos_leaves)] * 1000)
        expect = source
        self.assertEqual(expression.distribute_not(source), expect,
            "distribute_not on long expression without negation operator should not alter it")

        source = ['!'] + source
        expect = expression.AND([expression.OR(neg_leaves)] * 1000)
        self.assertEqual(expression.distribute_not(source), expect,
            "distribute_not on long expression applied wrongly")

    def test_accent(self):
        if not self.registry.has_unaccent:
            return
        TestBase = self.env['test.base']
        helene = TestBase.create({'name': u'Hélène'})
        self.assertEqual(helene, TestBase.search([('name','ilike','Helene')]))
        self.assertEqual(helene, TestBase.search([('name','ilike','hélène')]))
        self.assertNotIn(helene, TestBase.search([('name','not ilike','Helene')]))
        self.assertNotIn(helene, TestBase.search([('name','not ilike','hélène')]))

    def test_like_wildcards(self):
        # check that =like/=ilike expressions are working on an untranslated field
        TestMany2one = self.env['test.many2one']
        test_many2one = TestMany2one.search([('name', '=like', 'D__o_M_O')])
        self.assertTrue(len(test_many2one) == 1, "Must match one test base (Demo M2O)")
        test_many2one = TestMany2one.search([('name', '=ilike', 'D%')])
        self.assertTrue(len(test_many2one) >= 1, "Must match one test base (Demo M2O)")

        # check that =like/=ilike expressions are working on translated field
        TestBase = self.env['test.base']
        test_bases = TestBase.search([('name', '=like', 'P__e_t1')])
        self.assertTrue(len(test_bases) == 1, "Must match Parent1 only")
        test_bases = TestBase.search([('name', '=ilike', 'P%')])
        self.assertTrue(len(test_bases) == 2, "Must match only with demo data Parent1 and Parent2")

    def test_translate_search(self):
        TestBase = self.env['test.base']
        test_base_belgium = self.env.ref('test_base.test_base_belgium')
        domains = [
            [('name', '=', 'Belgium')],
            [('name', 'ilike', 'Belg')],
            [('name', 'in', ['Belgium', 'Care Bears'])],
        ]

        for domain in domains:
            test_bases = TestBase.search(domain)
            self.assertEqual(test_bases, test_base_belgium)

    def test_long_table_alias(self):
        # To test the 64 characters limit for table aliases in PostgreSQL
        self.patch_order('res.users', 'partner_id')
        self.patch_order('res.partner', 'commercial_partner_id,company_id,name')
        self.patch_order('res.company', 'parent_id')
        self.env['res.users'].search([('name', '=', 'test')])

    @mute_logger('odoo.sql_db')
    def test_invalid(self):
        """ verify that invalid expressions are refused, even for magic fields """
        TestBase = self.env['test.base']

        with self.assertRaises(ValueError):
            TestBase.search([('does_not_exist', '=', 'foo')])

        with self.assertRaises(ValueError):
            TestBase.search([('create_date', '>>', 'foo')])

        with self.assertRaises(psycopg2.DataError):
            TestBase.search([('create_date', '=', "1970-01-01'); --")])

    def test_active(self):
        # testing for many2many field with many2one_id Demo and active=False
        TestBase = self.env['test.base']
        vals = {
            'name': 'OpenERP Test',
            'active': False,
            'many2many_ids': [(6, 0, [self.ref("test_base.test_many2many_demo")])],
            'child_ids': [(0, 0, {'name': 'address of OpenERP Test', 'many2one_id': self.ref("test_base.test_many2one_demo")})],
        }
        TestBase.create(vals)
        test_bases = TestBase.search([('many2many_ids', 'ilike', 'Demo'), ('active', '=', False)])
        self.assertTrue(test_bases, "Record not Found with category vendor and active False.")

        # testing for one2many field with Demo 2 M2O and active=False
        test_bases = TestBase.search([('child_ids.many2one_id','=','Demo M2O'),('active','=',False)])
        self.assertTrue(test_bases, "Record not Found with name Belgium and active False.")

    def test_lp1071710(self):
        """ Check that we can exclude translated fields (bug lp:1071710) """
        # first install french language
        self.env['ir.translation'].load_module_terms(['test_base'], ['fr_FR'])
        # actual test
        TestBase = self.env['test.base']
        be = self.env.ref('test_base.test_base_belgium')
        not_be = TestBase.with_context(lang='fr_FR').search([('name', '!=', 'Belgique')])
        self.assertNotIn(be, not_be)

        # indirect search via m2o
        TestOne2many = self.env['test.one2many']
        o2m = TestOne2many.search([('login', '=', 'Demo O2M of Belgium')])

        not_be = TestOne2many.search([('test_base_id', '!=', 'Belgium')])
        self.assertNotIn(o2m, not_be)

        not_be = TestOne2many.with_context(lang='fr_FR').search([('test_base_id', '!=', 'Belgique')])
        self.assertNotIn(o2m, not_be)

    def test_or_with_implicit_and(self):
        # Check that when using expression.OR on a list of domains with at least one
        # implicit '&' the returned domain is the expected result.
        # from #24038
        d1 = [('foo', '=', 1), ('bar', '=', 1)]
        d2 = ['&', ('foo', '=', 2), ('bar', '=', 2)]

        expected = ['|', '&', ('foo', '=', 1), ('bar', '=', 1),
                         '&', ('foo', '=', 2), ('bar', '=', 2)]
        self.assertEqual(expression.OR([d1, d2]), expected)


class TestAutoJoin(TransactionCase):

    def setUp(self):
        super(TestAutoJoin, self).setUp()
        # Mock BaseModel._where_calc(), to be able to proceed to some tests about generated expression
        self._reinit_mock()
        BaseModel_where_calc = BaseModel._where_calc

        def _where_calc(model, *args, **kwargs):
            """ Mock `_where_calc` to be able to test its results. Store them
                into some internal variable for latter processing. """
            query = BaseModel_where_calc(model, *args, **kwargs)
            self.query_list.append(query)
            return query

        self.patch(BaseModel, '_where_calc', _where_calc)

    def _reinit_mock(self):
        self.query_list = []

    def test_auto_join(self):
        unaccent = expression.get_unaccent_wrapper(self.cr)

        # Get models
        TestBase = self.env['test.base']
        TestMany2one = self.env['test.many2one']
        TestOne2many = self.env['test.one2many']

        # Get test columns
        def patch_auto_join(model, fname, value):
            self.patch(model._fields[fname], 'auto_join', value)

        def patch_domain(model, fname, value):
            self.patch(model._fields[fname], 'domain', value)

        # Get sub M2O/M2O data
        sub_m2o = self.env['test.sub.many2one'].search([('name', 'like', 'Sub Demo M2O')], limit=1)
        m2os = self.env['test.many2one'].search([('sub_many2one_id', '=', sub_m2o.id)], limit=2)

        # Create demo data: test_bases and test_one2many object
        test_base_a = TestBase.create({'name': 'test__A', 'many2one_id': m2os[0].id})
        test_base_b = TestBase.create({'name': 'test__B', 'many2one_id': m2os[1].id})
        test_base_aa = TestBase.create({'name': 'test__AA', 'parent_id': test_base_a.id, 'many2one_id': m2os[0].id})
        test_base_ab = TestBase.create({'name': 'test__AB', 'parent_id': test_base_a.id, 'many2one_id': m2os[1].id})
        test_base_ba = TestBase.create({'name': 'test__BA', 'parent_id': test_base_b.id, 'many2one_id': m2os[0].id})
        o2m_aa = TestOne2many.create({'login': '123','test_base_id': test_base_aa.id})
        o2m_ab = TestOne2many.create({'login': '456', 'test_base_id': test_base_ab.id})
        o2m_ba = TestOne2many.create({'login': '789', 'test_base_id': test_base_ba.id})

        # --------------------------------------------------
        # Test1: basics about the attribute
        # --------------------------------------------------

        patch_auto_join(TestBase, 'many2many_ids', True)
        with self.assertRaises(NotImplementedError):
            TestBase.search([('many2many_ids.name', '=', 'foo')])

        # --------------------------------------------------
        # Test2: one2many
        # --------------------------------------------------

        name_test = '12'
        # Do: one2many without _auto_join
        patch_auto_join(TestBase, 'one2many_ids', False)
        self._reinit_mock()
        test_bases = TestBase.search([('one2many_ids.login', 'like', name_test)])
        # Test result
        self.assertEqual(test_bases, test_base_aa,
            "_auto_join off: ('one2many_ids.login', 'like', '..'): incorrect result")
        # Test produced queries
        self.assertEqual(len(self.query_list), 2,
            "_auto_join off: ('one2many_ids.login', 'like', '..') should produce 2 queries (1 in test_one2many, 1 on test_base)")
        sql_query = self.query_list[0].get_sql()
        self.assertIn('test_one2many', sql_query[0],
            "_auto_join off: ('one2many_ids.login', 'like', '..') first query incorrect main table")

        expected = "%s like %s" % (unaccent('"test_one2many"."login"::text'), unaccent('%s'))
        self.assertIn(expected, sql_query[1],
            "_auto_join off: ('one2many_ids.login', 'like', '..') first query incorrect where condition")

        self.assertEqual([True ,'%' + name_test + '%'], sql_query[2],
            "_auto_join off: ('one2many_ids.login', 'like', '..') first query incorrect parameter")
        sql_query = self.query_list[1].get_sql()
        self.assertIn('test_base', sql_query[0],
            "_auto_join off: ('one2many_ids.login', 'like', '..') second query incorrect main table")
        self.assertIn('"test_base"."id" in (%s)', sql_query[1],
            "_auto_join off: ('one2many_ids.login', 'like', '..') second query incorrect where condition")
        self.assertIn(test_base_aa.id, sql_query[2],
            "_auto_join off: ('one2many_ids.login', 'like', '..') second query incorrect parameter")

        # Do: cascaded one2many without _auto_join
        self._reinit_mock()
        test_bases = TestBase.search([('child_ids.one2many_ids.id', 'in', [o2m_aa.id, o2m_ba.id])])
        # Test result
        self.assertEqual(test_bases, test_base_a + test_base_b,
            "_auto_join off: ('child_ids.one2many_ids.id', 'in', [..]): incorrect result")
        # Test produced queries
        self.assertEqual(len(self.query_list), 3,
            "_auto_join off: ('child_ids.one2many_ids.id', 'in', [..]) should produce 3 queries (1 in test_one2many, 2 on test_base)")

        # Do: one2many with _auto_join
        patch_auto_join(TestBase, 'one2many_ids', True)
        self._reinit_mock()
        test_bases = TestBase.search([('one2many_ids.login', 'like', name_test)])
        # Test result
        self.assertEqual(test_bases, test_base_aa,
            "_auto_join on: ('one2many_ids.login', 'like', '..') incorrect result")
        # Test produced queries
        self.assertEqual(len(self.query_list), 1,
            "_auto_join on: ('one2many_ids.login', 'like', '..') should produce 1 query")
        sql_query = self.query_list[0].get_sql()
        self.assertIn('"test_base"', sql_query[0],
            "_auto_join on: ('one2many_ids.login', 'like', '..') query incorrect main table")
        self.assertIn('"test_one2many" as "test_base__one2many_ids"', sql_query[0],
            "_auto_join on: ('one2many_ids.login', 'like', '..') query incorrect join")

        expected = "%s like %s" % (unaccent('"test_base__one2many_ids"."login"::text'), unaccent('%s'))
        self.assertIn(expected, sql_query[1],
            "_auto_join on: ('one2many_ids.login', 'like', '..') query incorrect where condition")

        self.assertIn('"test_base"."id"="test_base__one2many_ids"."test_base_id"', sql_query[1],
            "_auto_join on: ('one2many_ids.login', 'like', '..') query incorrect join condition")
        self.assertIn('%' + name_test + '%', sql_query[2],
            "_auto_join on: ('one2many_ids.login', 'like', '..') query incorrect parameter")

        # Do: one2many with _auto_join, test final leaf is an id
        self._reinit_mock()
        o2m_ids = [o2m_aa.id, o2m_ab.id]
        test_bases = TestBase.search([('one2many_ids.id', 'in', o2m_ids)])
        # Test result
        self.assertEqual(test_bases, test_base_aa + test_base_ab,
            "_auto_join on: ('one2many_ids.id', 'in', [..]) incorrect result")
        # Test produced queries
        self.assertEqual(len(self.query_list), 1,
            "_auto_join on: ('one2many_ids.id', 'in', [..]) should produce 1 query")
        sql_query = self.query_list[0].get_sql()
        self.assertIn('"test_base"', sql_query[0],
            "_auto_join on: ('one2many_ids.id', 'in', [..]) query incorrect main table")
        self.assertIn('"test_base__one2many_ids"."id" in (%s,%s)', sql_query[1],
            "_auto_join on: ('one2many_ids.id', 'in', [..]) query incorrect where condition")
        self.assertLessEqual(set(o2m_ids), set(sql_query[2]),
            "_auto_join on: ('one2many_ids.id', 'in', [..]) query incorrect parameter")

        # Do: 2 cascaded one2many with _auto_join, test final leaf is an id
        patch_auto_join(TestBase, 'child_ids', True)
        self._reinit_mock()
        o2m_ids = [o2m_aa.id, o2m_ba.id]
        test_bases = TestBase.search([('child_ids.one2many_ids.id', 'in', o2m_ids)])
        # Test result
        self.assertEqual(test_bases, test_base_a + test_base_b,
            "_auto_join on: ('child_ids.one2many_ids.id', 'not in', [..]): incorrect result")
        # # Test produced queries
        self.assertEqual(len(self.query_list), 1,
            "_auto_join on: ('child_ids.one2many_ids.id', 'in', [..]) should produce 1 query")
        sql_query = self.query_list[0].get_sql()
        self.assertIn('"test_base"', sql_query[0],
            "_auto_join on: ('child_ids.one2many_ids.id', 'in', [..]) incorrect main table")
        self.assertIn('"test_base" as "test_base__child_ids"', sql_query[0],
            "_auto_join on: ('child_ids.one2many_ids.id', 'in', [..]) query incorrect join")
        self.assertIn('"test_one2many" as "test_base__child_ids__one2many_ids"', sql_query[0],
            "_auto_join on: ('child_ids.one2many_ids.id', 'in', [..]) query incorrect join")
        self.assertIn('"test_base__child_ids__one2many_ids"."id" in (%s,%s)', sql_query[1],
            "_auto_join on: ('child_ids.one2many_ids.id', 'in', [..]) query incorrect where condition")
        self.assertIn('"test_base"."id"="test_base__child_ids"."parent_id"', sql_query[1],
            "_auto_join on: ('child_ids.one2many_ids.id', 'in', [..]) query incorrect join condition")
        self.assertIn('"test_base__child_ids"."id"="test_base__child_ids__one2many_ids"."test_base_id"', sql_query[1],
            "_auto_join on: ('child_ids.one2many_ids.id', 'in', [..]) query incorrect join condition")
        self.assertLessEqual(set(o2m_ids), set(sql_query[2][-2:]),
            "_auto_join on: ('child_ids.one2many_ids.id', 'in', [..]) query incorrect parameter")

        # --------------------------------------------------
        # Test3: many2one
        # --------------------------------------------------
        name_test = 'Sub Demo'

        # Do: many2one without _auto_join
        self._reinit_mock()
        test_bases = TestBase.search([('many2one_id.sub_many2one_id.name', 'like', name_test)])
        # Test result: at least our added data + demo data
        self.assertLessEqual(test_base_a + test_base_b + test_base_aa + test_base_ab + test_base_ba, test_bases,
            "_auto_join off: ('many2one_id.sub_many2one_id.name', 'like', '..') incorrect result")
        # Test produced queries
        self.assertEqual(len(self.query_list), 3,
            "_auto_join off: ('many2one_id.sub_many2one_id.name', 'like', '..') should produce 3 queries (1 on test_sub_many2one, 1 on test_many2one, 1 on test_base)")

        # Do: many2one with 1 _auto_join on the first many2one
        patch_auto_join(TestBase, 'many2one_id', True)
        self._reinit_mock()
        test_bases = TestBase.search([('many2one_id.sub_many2one_id.name', 'like', name_test)])
        # Test result: at least our added data + demo data
        self.assertLessEqual(test_base_a + test_base_b + test_base_aa + test_base_ab + test_base_ba, test_bases,
            "_auto_join on for many2one_id: ('many2one_id.sub_many2one_id.name', 'like', '..') incorrect result")
        # Test produced queries
        self.assertEqual(len(self.query_list), 2,
            "_auto_join on for many2one_id: ('many2one_id.sub_many2one_id.name', 'like', '..') should produce 2 query")
        sql_query = self.query_list[0].get_sql()
        self.assertIn('"test_sub_many2one"', sql_query[0],
            "_auto_join on for many2one_id: ('many2one_id.sub_many2one_id.name', 'like', '..') query 1 incorrect main table")

        expected = "%s like %s" % (unaccent('"test_sub_many2one"."name"::text'), unaccent('%s'))
        self.assertIn(expected, sql_query[1],
            "_auto_join on for many2one_id: ('many2one_id.sub_many2one_id.name', 'like', '..') query 1 incorrect where condition")

        self.assertEqual(['%' + name_test + '%'], sql_query[2],
            "_auto_join on for many2one_id: ('many2one_id.sub_many2one_id.name', 'like', '..') query 1 incorrect parameter")
        sql_query = self.query_list[1].get_sql()
        self.assertIn('"test_base"', sql_query[0],
            "_auto_join on for many2one_id: ('many2one_id.sub_many2one_id.name', 'like', '..') query 2 incorrect main table")
        self.assertIn('"test_many2one" as "test_base__many2one_id"', sql_query[0],
            "_auto_join on for many2one_id: ('many2one_id.sub_many2one_id.name', 'like', '..') query 2 incorrect join")
        self.assertIn('"test_base__many2one_id"."sub_many2one_id" in (%s)', sql_query[1],
            "_auto_join on for many2one_id: ('many2one_id.sub_many2one_id.name', 'like', '..') query 2 incorrect where condition")
        self.assertIn('"test_base"."many2one_id"="test_base__many2one_id"."id"', sql_query[1],
            "_auto_join on for many2one_id: ('many2one_id.sub_many2one_id.name', 'like', '..') query 2 incorrect join condition")

        # Do: many2one with 1 _auto_join on the second many2one
        patch_auto_join(TestBase, 'many2one_id', False)
        patch_auto_join(TestMany2one, 'sub_many2one_id', True)
        self._reinit_mock()
        test_bases = TestBase.search([('many2one_id.sub_many2one_id.name', 'like', name_test)])
        # Test result: at least our added data + demo data
        self.assertLessEqual(test_base_a + test_base_b + test_base_aa + test_base_ab + test_base_ba, test_bases,
            "_auto_join on for sub_many2one_id: ('many2one_id.sub_many2one_id.name', 'like', '..') incorrect result")
        # Test produced queries
        self.assertEqual(len(self.query_list), 2,
            "_auto_join on for sub_many2one_id: ('many2one_id.sub_many2one_id.name', 'like', '..') should produce 2 query")
        # -- first query
        sql_query = self.query_list[0].get_sql()
        self.assertIn('"test_sub_many2one"', sql_query[0],
            "_auto_join on for sub_many2one_id: ('many2one_id.sub_many2one_id.name', 'like', '..') query 1 incorrect main table")
        self.assertIn('"test_sub_many2one" as "test_many2one__sub_many2one_id"', sql_query[0],
            "_auto_join on for sub_many2one_id: ('many2one_id.sub_many2one_id.name', 'like', '..') query 1 incorrect join")

        expected = "%s like %s" % (unaccent('"test_many2one__sub_many2one_id"."name"::text'), unaccent('%s'))
        self.assertIn(expected, sql_query[1],
            "_auto_join on for sub_many2one_id: ('many2one_id.sub_many2one_id.name', 'like', '..') query 1 incorrect where condition")

        self.assertIn('"test_many2one"."sub_many2one_id"="test_many2one__sub_many2one_id"."id"', sql_query[1],
            "_auto_join on for sub_many2one_id: ('many2one_id.sub_many2one_id.name', 'like', '..') query 1 incorrect join condition")
        self.assertEqual(['%' + name_test + '%'], sql_query[2],
            "_auto_join on for sub_many2one_id: ('many2one_id.sub_many2one_id.name', 'like', '..') query 1 incorrect parameter")
        # -- second query
        sql_query = self.query_list[1].get_sql()
        self.assertIn('"test_base"', sql_query[0],
            "_auto_join on for sub_many2one_id: ('many2one_id.sub_many2one_id.name', 'like', '..') query 2 incorrect main table")
        self.assertIn('"test_base"."many2one_id" in', sql_query[1],
            "_auto_join on for sub_many2one_id: ('many2one_id.sub_many2one_id.name', 'like', '..') query 2 incorrect where condition")

        # Do: many2one with 2 _auto_join
        patch_auto_join(TestBase, 'many2one_id', True)
        patch_auto_join(TestMany2one, 'sub_many2one_id', True)
        self._reinit_mock()
        test_bases = TestBase.search([('many2one_id.sub_many2one_id.name', 'like', name_test)])
        # Test result: at least our added data + demo data
        self.assertLessEqual(test_base_a + test_base_b + test_base_aa + test_base_ab + test_base_ba, test_bases,
            "_auto_join on: ('many2one_id.sub_many2one_id.name', 'like', '..') incorrect result")
        # Test produced queries
        self.assertEqual(len(self.query_list), 1,
            "_auto_join on: ('many2one_id.sub_many2one_id.name', 'like', '..') should produce 1 query")
        sql_query = self.query_list[0].get_sql()
        self.assertIn('"test_base"', sql_query[0],
            "_auto_join on: ('many2one_id.sub_many2one_id.name', 'like', '..') query incorrect main table")
        self.assertIn('"test_many2one" as "test_base__many2one_id"', sql_query[0],
            "_auto_join on: ('many2one_id.sub_many2one_id.name', 'like', '..') query incorrect join")
        self.assertIn('"test_sub_many2one" as "test_base__many2one_id__sub_many2one_id"', sql_query[0],
            "_auto_join on: ('many2one_id.sub_many2one_id.name', 'like', '..') query incorrect join")

        expected = "%s like %s" % (unaccent('"test_base__many2one_id__sub_many2one_id"."name"::text'), unaccent('%s'))
        self.assertIn(expected, sql_query[1],
            "_auto_join on: ('many2one_id.sub_many2one_id.name', 'like', '..') query incorrect where condition")

        self.assertIn('"test_base"."many2one_id"="test_base__many2one_id"."id"', sql_query[1],
            "_auto_join on: ('many2one_id.sub_many2one_id.name', 'like', '..') query incorrect join condition")
        self.assertIn('"test_base__many2one_id"."sub_many2one_id"="test_base__many2one_id__sub_many2one_id"."id"', sql_query[1],
            "_auto_join on: ('many2one_id.sub_many2one_id.name', 'like', '..') query incorrect join condition")
        self.assertIn('%' + name_test + '%', sql_query[2],
            "_auto_join on: ('many2one_id.sub_many2one_id.name', 'like', '..') query incorrect parameter")

        # --------------------------------------------------
        # Test4: domain attribute on one2many fields
        # --------------------------------------------------

        patch_auto_join(TestBase, 'child_ids', True)
        patch_auto_join(TestBase, 'one2many_ids', True)
        patch_domain(TestBase, 'child_ids', lambda self: ['!', ('name', '=', self._name)])
        patch_domain(TestBase, 'one2many_ids', [('login', 'like', '2')])
        self.patch(TestBase._fields['name'], 'translate', False)
        # Do: 2 cascaded one2many with _auto_join, test final leaf is an id
        self._reinit_mock()
        test_bases = TestBase.search(['!', ('name', '=', 'HGFDFGHGFD') ,'&', (1, '=', 1), ('child_ids.one2many_ids.id', 'in', [o2m_aa.id, o2m_ba.id])])
        # Test result: at least one of our added data
        self.assertLessEqual(test_base_a, test_bases,
            "_auto_join on one2many with domains incorrect result")
        self.assertFalse((test_base_ab + test_base_ba) & test_bases,
            "_auto_join on one2many with domains incorrect result")
        # Test produced queries that domains effectively present
        sql_query = self.query_list[0].get_sql()

        expected = "%s like %s" % (unaccent('"test_base__child_ids__one2many_ids"."login"::text'), unaccent('%s'))
        self.assertIn(expected, sql_query[1],
            "_auto_join on one2many with domains incorrect result")
        # TDE TODO: check first domain has a correct table name
        self.assertIn('"test_base__child_ids"."name" = %s', sql_query[1],
            "_auto_join on one2many with domains incorrect result")

        patch_domain(TestBase, 'child_ids', lambda self: [('name', '=', '__%s' % self._name)])
        self._reinit_mock()
        test_bases = TestBase.search(['&', (1, '=', 1), ('child_ids.one2many_ids.id', 'in', [o2m_aa.id, o2m_ba.id])])
        # Test result: no one
        self.assertFalse(test_bases,
            "_auto_join on one2many with domains incorrect result")

        # ----------------------------------------
        # Test5: result-based tests
        # ----------------------------------------

        patch_auto_join(TestBase, 'one2many_ids', False)
        patch_auto_join(TestBase, 'child_ids', False)
        patch_auto_join(TestBase, 'many2one_id', False)
        patch_auto_join(TestBase, 'parent_id', False)
        patch_auto_join(TestMany2one, 'sub_many2one_id', False)
        patch_domain(TestBase, 'child_ids', [])
        patch_domain(TestBase, 'one2many_ids', [])

        # Do: ('child_ids.many2one_id.sub_many2one_id.name', 'like', '..') without _auto_join
        self._reinit_mock()
        test_bases = TestBase.search([('child_ids.many2one_id.sub_many2one_id.name', 'like', name_test)])
        # Test result: at least our added data + demo data
        self.assertLessEqual(test_base_a + test_base_b, test_bases,
            "_auto_join off: ('child_ids.many2one_id.sub_many2one_id.name', 'like', '..') incorrect result")
        # Test produced queries
        self.assertEqual(len(self.query_list), 4,
            "_auto_join off: ('child_ids.many2one_id.sub_many2one_id.name', 'like', '..') number of queries incorrect")

        # Do: ('child_ids.many2one_id.sub_many2one_id.name', 'like', '..') with _auto_join
        patch_auto_join(TestBase, 'child_ids', True)
        patch_auto_join(TestBase, 'many2one_id', True)
        patch_auto_join(TestMany2one, 'sub_many2one_id', True)
        self._reinit_mock()
        test_bases = TestBase.search([('child_ids.many2one_id.sub_many2one_id.name', 'like', name_test)])
        # Test result: at least our added data + demo data
        self.assertLessEqual(test_base_a + test_base_b, test_bases,
            "_auto_join on: ('child_ids.many2one_id.sub_many2one_id.code', 'like', '..') incorrect result")
        # Test produced queries
        self.assertEqual(len(self.query_list), 1,
            "_auto_join on: ('child_ids.many2one_id.sub_many2one_id.name', 'like', '..') number of queries incorrect")
