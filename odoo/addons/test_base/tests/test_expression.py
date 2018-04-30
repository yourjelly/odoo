# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import psycopg2

from odoo.models import BaseModel
from odoo.tests.common import TransactionCase
from odoo.tools import mute_logger
from odoo.osv import expression


class TestExpression(TransactionCase):

    def test_00_in_not_in_m2m(self):
        # Create 4 test_base record with no test_base_many2one, or one or two many2many.
        TestMany2many = self.env['test_base.many2many']
        m2m_a = TestMany2many.create({'name': 'test_expression_m2m_A'})
        m2m_b = TestMany2many.create({'name': 'test_expression_m2m_B'})

        TestbaseModel = self.env['test_base.model']
        a = TestbaseModel.create({'name': 'test_expression_test_base_model_A', 'many2many_ids': [(6, 0, [m2m_a.id])]})
        b = TestbaseModel.create({'name': 'test_expression_test_base_model_B', 'many2many_ids': [(6, 0, [m2m_b.id])]})
        ab = TestbaseModel.create({'name': 'test_expression_test_base_model_AB', 'many2many_ids': [(6, 0, [m2m_a.id, m2m_b.id])]})
        c = TestbaseModel.create({'name': 'test_expression_test_base_model_C'})

        # The tests.

        # On a one2many or many2many field, `in` should be read `contains` (and
        # `not in` should be read `doesn't contain`.

        with_a = TestbaseModel.search([('many2many_ids', 'in', [m2m_a.id])])
        self.assertEqual(a + ab, with_a, "Search for many2many_ids in m2m_a failed.")

        with_b = TestbaseModel.search([('many2many_ids', 'in', [m2m_b.id])])
        self.assertEqual(b + ab, with_b, "Search for many2many_ids in m2m_b failed.")

        # Test base with the many2many A or the many2many B.
        with_a_or_b = TestbaseModel.search([('many2many_ids', 'in', [m2m_a.id, m2m_b.id])])
        self.assertEqual(a + b + ab, with_a_or_b, "Search for many2many_ids contains m2m_a or m2m_b failed.")

        # Show that `contains list` is really `contains element or contains element`.
        with_a_or_with_b = TestbaseModel.search(['|', ('many2many_ids', 'in', [m2m_a.id]), ('many2many_ids', 'in', [m2m_b.id])])
        self.assertEqual(a + b + ab, with_a_or_with_b, "Search for many2many_ids contains m2m_a or contains m2m_b failed.")

        # If we change the OR in AND...
        with_a_and_b = TestbaseModel.search([('many2many_ids', 'in', [m2m_a.id]), ('many2many_ids', 'in', [m2m_b.id])])
        self.assertEqual(ab, with_a_and_b, "Search for many2many_ids contains m2m_a and m2m_b failed.")

        # Test base without many2many A and without many2many B.
        without_a_or_b = TestbaseModel.search([('many2many_ids', 'not in', [m2m_a.id, m2m_b.id])])
        self.assertFalse(without_a_or_b & (a + b + ab), "Search for many2many_ids doesn't contain m2m_a or m2m_b failed (1).")
        self.assertTrue(c in without_a_or_b, "Search for many2many_ids doesn't contain m2m_a or m2m_b failed (2).")

        # Show that `doesn't contain list` is really `doesn't contain element and doesn't contain element`.
        without_a_and_without_b = TestbaseModel.search([('many2many_ids', 'not in', [m2m_a.id]), ('many2many_ids', 'not in', [m2m_b.id])])
        self.assertFalse(without_a_and_without_b & (a + b + ab), "Search for many2many_ids doesn't contain m2m_a and m2m_b failed (1).")
        self.assertTrue(c in without_a_and_without_b, "Search for many2many_ids doesn't contain m2m_a and m2m_b failed (2).")

        # We can exclude any test_base containing the category A.
        without_a = TestbaseModel.search([('many2many_ids', 'not in', [m2m_a.id])])
        self.assertTrue(a not in without_a, "Search for many2many_ids doesn't contain m2m_a failed (1).")
        self.assertTrue(ab not in without_a, "Search for many2many_ids doesn't contain m2m_a failed (2).")
        self.assertLessEqual(b + c, without_a, "Search for many2many_ids doesn't contain m2m_a failed (3).")

        # (Obviously we can do the same for cateory B.)
        without_b = TestbaseModel.search([('many2many_ids', 'not in', [m2m_b.id])])
        self.assertTrue(b not in without_b, "Search for many2many_ids doesn't contain m2m_b failed (1).")
        self.assertTrue(ab not in without_b, "Search for many2many_ids doesn't contain m2m_b failed (2).")
        self.assertLessEqual(a + c, without_b, "Search for many2many_ids doesn't contain m2m_b failed (3).")

    def test_05_not_str_m2m(self):
        TestbaseModel = self.env['test_base.model']
        TestMany2many = self.env['test_base.many2many']

        m2m_ids = {}
        for name in 'A B AB'.split():
            m2m_ids[name] = TestMany2many.create({'name': name}).id

        test_base_models_config = {
            '0': [],
            'a': [m2m_ids['A']],
            'b': [m2m_ids['B']],
            'ab': [m2m_ids['AB']],
            'a b': [m2m_ids['A'], m2m_ids['B']],
            'b ab': [m2m_ids['B'], m2m_ids['AB']],
        }
        test_base_model_ids = {}
        for name, m2m_ids in test_base_models_config.items():
            test_base_model_ids[name] = TestbaseModel.create({'name': name, 'many2many_ids': [(6, 0, m2m_ids)]}).id

        base_domain = [('id', 'in', list(test_base_model_ids.values()))]

        def test(op, value, expected):
            found_ids = TestbaseModel.search(base_domain + [('many2many_ids', op, value)]).ids
            expected_ids = [test_base_model_ids[name] for name in expected]
            self.assertItemsEqual(found_ids, expected_ids, '%s %r should return %r' % (op, value, expected))

        test('=', 'A', ['a', 'a b'])
        test('!=', 'B', ['0', 'a', 'ab'])
        test('like', 'A', ['a', 'ab', 'a b', 'b ab'])
        test('not ilike', 'B', ['0', 'a'])
        test('not like', 'AB', ['0', 'a', 'b', 'a b'])

    def test_10_hierarchy_in_m2m(self):
        TestbaseModel = self.env['test_base.model']
        TestMany2many = self.env['test_base.many2many']

        # search through m2m relation
        test_base_models = TestbaseModel.search([('many2many_ids', 'child_of', self.ref('test_base.many2many_test'))])
        self.assertTrue(test_base_models)

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

        # test hierarchical search in m2m with an empty list
        cats = TestMany2many.search([('id', 'child_of', [])])
        self.assertEqual(len(cats), 0)

        # test hierarchical search in m2m with 'False' value
        with self.assertLogs('odoo.osv.expression'):
            cats = TestMany2many.search([('id', 'child_of', False)])
        self.assertEqual(len(cats), 0)

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

        # test hierarchical search in m2m with an empty list
        cats = TestMany2many.search([('id', 'parent_of', [])])
        self.assertEqual(len(cats), 0)

        # test hierarchical search in m2m with 'False' value
        with self.assertLogs('odoo.osv.expression'):
            cats = TestMany2many.search([('id', 'parent_of', False)])
        self.assertEqual(len(cats), 0)

    def test_10_equivalent_id(self):
        # equivalent queries
        TestbaseModel = self.env['test_base.model']
        non_test_base_model_id = max(TestbaseModel.search([]).ids) + 1003
        test_base_models_0 = TestbaseModel.search([])
        test_base_models_1 = TestbaseModel.search([('name', 'not like', 'probably_unexisting_name')])
        self.assertEqual(test_base_models_0, test_base_models_1)
        test_base_models_2 = TestbaseModel.search([('id', 'not in', [non_test_base_model_id])])
        self.assertEqual(test_base_models_0, test_base_models_2)
        test_base_models_3 = TestbaseModel.search([('id', 'not in', [])])
        self.assertEqual(test_base_models_0, test_base_models_3)
        test_base_models_4 = TestbaseModel.search([('id', '!=', False)])
        self.assertEqual(test_base_models_0, test_base_models_4)

        # equivalent queries, integer and string
        all_test_base_models = TestbaseModel.search([])
        self.assertTrue(len(all_test_base_models) > 1)
        one = all_test_base_models[0]
        others = all_test_base_models[1:]

        test_base_models_1 = TestbaseModel.search([('id', '=', one.id)])
        self.assertEqual(one, test_base_models_1)
        # TestbaseModel.search([('id', '!=', others)]) # not permitted
        test_base_models_2 = TestbaseModel.search([('id', 'not in', others.ids)])
        self.assertEqual(one, test_base_models_2)
        test_base_models_3 = TestbaseModel.search(['!', ('id', '!=', one.id)])
        self.assertEqual(one, test_base_models_3)
        test_base_models_4 = TestbaseModel.search(['!', ('id', 'in', others.ids)])
        self.assertEqual(one, test_base_models_4)
        # res_5 = Partner.search([('id', 'in', one)]) # TODO make it permitted, just like for child_of
        # self.assertEqual(one, res_5)
        test_base_models_6 = TestbaseModel.search([('id', 'in', [one.id])])
        self.assertEqual(one, test_base_models_6)
        test_base_models_7 = TestbaseModel.search([('name', '=', one.name)])
        self.assertEqual(one, test_base_models_7)
        test_base_models_8 = TestbaseModel.search([('name', 'in', [one.name])])
        # res_9 = Partner.search([('name', 'in', one.name)]) # TODO

    def test_15_m2o(self):
        TestbaseModel = self.env['test_base.model']

        # testing equality with name
        test_base_models = TestbaseModel.search([('parent_id', '=', 'Parent1')])
        self.assertTrue(test_base_models)

        # testing the in operator with name
        test_base_models = TestbaseModel.search([('parent_id', 'in', 'Parent1')])
        self.assertTrue(test_base_models)

        # testing the in operator with a list of names
        test_base_models = TestbaseModel.search([('parent_id', 'in', ['Parent1', 'Parent2'])])
        self.assertTrue(test_base_models)

        # check if many2one works with empty search list
        test_base_models = TestbaseModel.search([('many2one_id', 'in', [])])
        self.assertFalse(test_base_models)

        # create new many2one with test_base_models, and test_base_models with no many2one
        test_many2one_2 = self.env['test_base.many2one'].create({'name': 'Acme 2'})
        for i in range(4):
            TestbaseModel.create({'name': 'P of Acme %s' % i, 'many2one_id': test_many2one_2.id})
            TestbaseModel.create({'name': 'P of All %s' % i, 'many2one_id': False})

        # check if many2one works with negative empty list
        all_test_base_models = TestbaseModel.search([])
        test_base_models = TestbaseModel.search(['|', ('many2one_id', 'not in', []), ('many2one_id', '=', False)])
        self.assertEqual(all_test_base_models, test_base_models, "not in [] fails")

        # check that many2one will pick the correct records with a list
        test_base_models = TestbaseModel.search([('many2one_id', 'in', [False])])
        self.assertTrue(len(test_base_models) >= 4, "We should have at least 4 test base records with no many2one")

        # check that many2one will exclude the correct records with a list
        test_base_models = TestbaseModel.search([('many2one_id', 'not in', [1])])
        self.assertTrue(len(test_base_models) >= 4, "We should have at least 4 test base records not related to many2one #1")

        # check that many2one will exclude the correct records with a list and False
        test_base_models = TestbaseModel.search(['|', ('many2one_id', 'not in', [1]),
                                        ('many2one_id', '=', False)])
        self.assertTrue(len(test_base_models) >= 8, "We should have at least 8 test base records not related to many2one #1")

        # check that multi-level expressions also work
        test_base_models = TestbaseModel.search([('many2one_id.child_m2o_id', 'in', [])])
        self.assertFalse(test_base_models)

        # check multi-level expressions with magic columns
        test_base_models = TestbaseModel.search([('create_uid.active', '=', True)])

        # check that multi-level expressions with negative op work
        all_test_base_models = TestbaseModel.search([('many2one_id', '!=', False)])
        test_base_models = TestbaseModel.search([('many2one_id.child_m2o_id', 'not in', [])])
        self.assertEqual(all_test_base_models, test_base_models, "not in [] fails")

        # Test the '(not) like/in' behavior. test_base.model and its parent_id
        # column are used because parent_id is a many2one, allowing to test the
        # Null value, and there are actually some null and non-null values in
        # the test data.
        all_test_base_models = TestbaseModel.search([])
        non_test_base_model = max(all_test_base_models.ids) + 1

        with_parent = all_test_base_models.filtered(lambda p: p.parent_id)
        without_parent = all_test_base_models.filtered(lambda p: not p.parent_id)
        with_name = all_test_base_models.filtered(lambda p: p.name)

        # We treat null values differently than in SQL. For instance in SQL:
        #   SELECT id FROM test_base_model WHERE parent_id NOT IN (0)
        # will return only the records with non-null parent_id.
        #   SELECT id FROM test_base_model WHERE parent_id IN (0)
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
        test_base_models_0 = TestbaseModel.search([('parent_id', 'not like', 'probably_unexisting_name')]) # get all rows, included null parent_id
        self.assertEqual(test_base_models_0, all_test_base_models)
        test_base_models_1 = TestbaseModel.search([('parent_id', 'not in', [non_test_base_model])]) # get all rows, included null parent_id
        self.assertEqual(test_base_models_1, all_test_base_models)
        test_base_models_2 = TestbaseModel.search([('parent_id', '!=', False)]) # get rows with not null parent_id, deprecated syntax
        self.assertEqual(test_base_models_2, with_parent)
        test_base_models_3 = TestbaseModel.search([('parent_id', 'not in', [])]) # get all rows, included null parent_id
        self.assertEqual(test_base_models_3, all_test_base_models)
        test_base_models_4 = TestbaseModel.search([('parent_id', 'not in', [False])]) # get rows with not null parent_id
        self.assertEqual(test_base_models_4, with_parent)
        test_base_models_4b = TestbaseModel.search([('parent_id', 'not ilike', '')]) # get only rows without parent
        self.assertEqual(test_base_models_4b, without_parent)

        # The results of these queries, when combined with queries 0..4 must
        # give the whole set of ids.
        test_base_models_5 = TestbaseModel.search([('parent_id', 'like', 'probably_unexisting_name')])
        self.assertFalse(test_base_models_5)
        test_base_models_6 = TestbaseModel.search([('parent_id', 'in', [non_test_base_model])])
        self.assertFalse(test_base_models_6)
        test_base_models_7 = TestbaseModel.search([('parent_id', '=', False)])
        self.assertEqual(test_base_models_7, without_parent)
        test_base_models_8 = TestbaseModel.search([('parent_id', 'in', [])])
        self.assertFalse(test_base_models_8)
        test_base_models_9 = TestbaseModel.search([('parent_id', 'in', [False])])
        self.assertEqual(test_base_models_9, without_parent)
        test_base_models_9b = TestbaseModel.search([('parent_id', 'ilike', '')]) # get those with a parent
        self.assertEqual(test_base_models_9b, with_parent)

        # These queries must return exactly the results than the queries 0..4,
        # i.e. not ... in ... must be the same as ... not in ... .
        test_base_models_10 = TestbaseModel.search(['!', ('parent_id', 'like', 'probably_unexisting_name')])
        self.assertEqual(test_base_models_0, test_base_models_10)
        test_base_models_11 = TestbaseModel.search(['!', ('parent_id', 'in', [non_test_base_model])])
        self.assertEqual(test_base_models_1, test_base_models_11)
        test_base_models_12 = TestbaseModel.search(['!', ('parent_id', '=', False)])
        self.assertEqual(test_base_models_2, test_base_models_12)
        test_base_models_13 = TestbaseModel.search(['!', ('parent_id', 'in', [])])
        self.assertEqual(test_base_models_3, test_base_models_13)
        test_base_models_14 = TestbaseModel.search(['!', ('parent_id', 'in', [False])])
        self.assertEqual(test_base_models_4, test_base_models_14)

        # Testing many2one field is not enough, a regular char field is tested
        test_base_models_15 = TestbaseModel.search([('name', 'in', [])])
        self.assertFalse(test_base_models_15)
        test_base_models_16 = TestbaseModel.search([('name', 'not in', [])])
        self.assertEqual(test_base_models_16, all_test_base_models)
        test_base_models_17 = TestbaseModel.search([('name', '!=', False)])
        self.assertEqual(test_base_models_17, with_name)

        # check behavior for required many2one fields: child_m2o_id is required
        test_many2one = self.env['test_base.many2one'].search([])
        test_many2one_101 = test_many2one.search([('child_m2o_id', 'not ilike', '')]) # get no test many2one
        self.assertFalse(test_many2one_101)
        test_many2one_102 = test_many2one.search([('child_m2o_id', 'ilike', '')]) # get all test many2one
        self.assertEqual(test_many2one_102, test_many2one)

    def test_in_operator(self):
        """ check that we can use the 'in' operator for plain fields """
        menus = self.env['ir.ui.menu'].search([('sequence', 'in', [1, 2, 10, 20])])
        self.assertTrue(menus)

    def test_15_o2m(self):
        TestbaseModel = self.env['test_base.model']

        # test one2many operator with empty search list
        test_base_models = TestbaseModel.search([('child_ids', 'in', [])])
        self.assertFalse(test_base_models)

        # test one2many operator with False
        test_base_models = TestbaseModel.search([('child_ids', '=', False)])
        for test_base in test_base_models:
            self.assertFalse(test_base.child_ids)

        # verify domain evaluation for one2many != False and one2many == False
        test_base_models = TestbaseModel.search([])
        parents = TestbaseModel.search([('child_ids', '!=', False)])
        self.assertEqual(parents, test_base_models.filtered(lambda c: c.child_ids))
        leafs = TestbaseModel.search([('child_ids', '=', False)])
        self.assertEqual(leafs, test_base_models.filtered(lambda c: not c.child_ids))

        # test many2many operator with empty search list
        test_base_models = TestbaseModel.search([('many2many_ids', 'in', [])])
        self.assertFalse(test_base_models)

        # test many2many operator with False
        test_base_models = TestbaseModel.search([('many2many_ids', '=', False)])
        for test_base in test_base_models:
            self.assertFalse(test_base.many2many_ids)

        # filtering on nonexistent value across x2many should return nothing
        test_base_models = TestbaseModel.search([('child_ids.name', '=', 'foo')])
        self.assertFalse(test_base_models)

    def test_15_equivalent_one2many_1(self):
        TestbaseModel = self.env['test_base.model']
        test_base_model3 = TestbaseModel.create({'name': 'Acme 3'})
        test_base_model4 = TestbaseModel.create({'name': 'Acme 4', 'parent_id': test_base_model3.id})

        # one2many towards same model
        test_base_model_1 = TestbaseModel.search([('child_ids', 'in', test_base_model3.child_ids.ids)]) # any company having a child of company3 as child
        self.assertEqual(test_base_model_1, test_base_model3)
        test_base_model_2 = TestbaseModel.search([('child_ids', 'in', test_base_model3.child_ids[0].ids)]) # any company having the first child of company3 as child
        self.assertEqual(test_base_model_2, test_base_model3)

        # child_of x returns x and its children (direct or not).
        expected = test_base_model3 + test_base_model4
        test_base_model_1 = TestbaseModel.search([('id', 'child_of', [test_base_model3.id])])
        self.assertEqual(test_base_model_1, expected)
        test_base_model_2 = TestbaseModel.search([('id', 'child_of', test_base_model3.id)])
        self.assertEqual(test_base_model_2, expected)
        test_base_model_3 = TestbaseModel.search([('id', 'child_of', [test_base_model3.name])])
        self.assertEqual(test_base_model_3, expected)
        test_base_model_4 = TestbaseModel.search([('id', 'child_of', test_base_model3.name)])
        self.assertEqual(test_base_model_4, expected)

        # parent_of x returns x and its parents (direct or not).
        expected = test_base_model3 + test_base_model4
        test_base_model_1 = TestbaseModel.search([('id', 'parent_of', [test_base_model4.id])])
        self.assertEqual(test_base_model_1, expected)
        test_base_model_2 = TestbaseModel.search([('id', 'parent_of', test_base_model4.id)])
        self.assertEqual(test_base_model_2, expected)
        test_base_model_3 = TestbaseModel.search([('id', 'parent_of', [test_base_model4.name])])
        self.assertEqual(test_base_model_3, expected)
        test_base_model_4 = TestbaseModel.search([('id', 'parent_of', test_base_model4.name)])
        self.assertEqual(test_base_model_4, expected)

        # try testing real subsets with IN/NOT IN
        TestOne2many = self.env['test_base.one2many']
        test_base_model1, _ = TestbaseModel.name_create({'name':"Dédé Boitaclou"})
        test_base_model2, _ = TestbaseModel.name_create("Raoulette Pizza O'poil")
        o2ma = TestOne2many.create({'login': 'dbo', 'test_base_model_id': test_base_model1}).id
        o2mb = TestOne2many.create({'login': 'dbo2', 'test_base_model_id': test_base_model1}).id
        o2m2 = TestOne2many.create({'login': 'rpo', 'test_base_model_id': test_base_model2}).id
        self.assertEqual([test_base_model1], TestbaseModel.search([('one2many_ids', 'in', o2ma)]).ids, "o2m IN accept single int on right side")
        self.assertEqual([test_base_model1], TestbaseModel.search([('one2many_ids', 'ilike', 'Dédé Boitaclou')]).ids, "o2m NOT IN matches none on the right side")
        self.assertEqual([], TestbaseModel.search([('one2many_ids', 'in', [10000])]).ids, "o2m NOT IN matches none on the right side")
        self.assertEqual([test_base_model1, test_base_model2], TestbaseModel.search([('one2many_ids', 'in', [o2ma,o2m2])]).ids, "o2m IN matches any on the right side")
        all_ids = TestbaseModel.search([]).ids
        self.assertEqual(set(all_ids) - set([test_base_model1]), set(TestbaseModel.search([('one2many_ids', 'not in', o2ma)]).ids), "o2m NOT IN matches none on the right side")
        self.assertEqual(set(all_ids) - set([test_base_model1]), set(TestbaseModel.search([('one2many_ids', 'not like', 'Dédé Boitaclou')]).ids), "o2m NOT IN matches none on the right side")
        self.assertEqual(set(all_ids) - set([test_base_model1, test_base_model2]), set(TestbaseModel.search([('one2many_ids', 'not in', [o2mb, o2m2])]).ids), "o2m NOT IN matches none on the right side")

    def test_15_equivalent_one2many_2(self):
        TestbaseModel = self.env['test_base.model']
        TestOne2many = self.env['test_base.one2many']

        # create a TestbaseModel and a Test One2many
        test_base = TestbaseModel.create({'name': 'ZZZ'})
        o2m = TestOne2many.create({'login': 'O2M ZZZ', 'test_base_model_id': test_base.id})
        non_o2m_id = o2m.id + 1000
        default_test_base_model = TestbaseModel.browse(1)

        # search the TestbaseModel via its rates one2many (the one2many must point back at the TestbaseModel)
        o2m1 = TestOne2many.search([('name', 'not like', 'probably_unexisting_name')])
        o2m2 = TestOne2many.search([('id', 'not in', [non_o2m_id])])
        self.assertEqual(o2m1, o2m2)
        o2m3 = TestOne2many.search([('id', 'not in', [])])
        self.assertEqual(o2m1, o2m3)

        # one2many towards another model
        test_base_model_1 = TestbaseModel.search([('one2many_ids', 'in', default_test_base_model.one2many_ids.ids)]) # TestbaseModel having a o2m value of default test base
        self.assertEqual(test_base_model_1, default_test_base_model)
        test_base_model_2 = TestbaseModel.search([('one2many_ids', 'in', default_test_base_model.one2many_ids[0].ids)]) # TestbaseModel having first o2m value of default test base
        self.assertEqual(test_base_model_2, default_test_base_model)
        test_base_model_3 = TestbaseModel.search([('one2many_ids', 'in', default_test_base_model.one2many_ids[0].id)]) # TestbaseModel having first o2m value of default test base
        self.assertEqual(test_base_model_3, default_test_base_model)

        test_base_model_4 = TestbaseModel.search([('one2many_ids', 'like', 'probably_unexisting_name')])
        self.assertFalse(test_base_model_4)
        # Currency.search([('rate_ids', 'unexisting_op', 'probably_unexisting_name')]) # TODO expected exception

        # get the currencies referenced by some currency rates using a weird negative domain
        test_base_model_5 = TestbaseModel.search([('one2many_ids', 'not like', 'probably_unexisting_name')])
        test_base_model_6 = TestbaseModel.search([('one2many_ids', 'not in', [non_o2m_id])])
        self.assertEqual(test_base_model_5, test_base_model_6)
        test_base_model_7 = TestbaseModel.search([('one2many_ids', '!=', False)])
        self.assertEqual(test_base_model_5, test_base_model_7)
        test_base_model_8 = TestbaseModel.search([('one2many_ids', 'not in', [])])
        self.assertEqual(test_base_model_5, test_base_model_8)

    def test_20_expression_parse(self):
        # TDE note: those tests have been added when refactoring the expression.parse() method.
        # They come in addition to the already existing tests; maybe some tests
        # will be a bit redundant
        TestOne2many = self.env['test_base.one2many']

        # Create users
        a = TestOne2many.create({'name': 'test_A', 'login': 'test_A'})
        b1 = TestOne2many.create({'name': 'test_B', 'login': 'test_B'})
        b2 = TestOne2many.create({'name': 'test_B2', 'login': 'test_B2', 'parent_id': b1.test_base_model_id.id})

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
        o2ms = TestOne2many.search([('name', 'like', 'test'), ('parent_id', '=?', b1.test_base_model_id.id)])
        self.assertEqual(o2ms, b2, '(x =? id) failed')

    def test_30_normalize_domain(self):
        norm_domain = domain = ['&', (1, '=', 1), ('a', '=', 'b')]
        self.assertEqual(norm_domain, expression.normalize_domain(domain), "Normalized domains should be left untouched")
        domain = [('x', 'in', ['y', 'z']), ('a.v', '=', 'e'), '|', '|', ('a', '=', 'b'), '!', ('c', '>', 'd'), ('e', '!=', 'f'), ('g', '=', 'h')]
        norm_domain = ['&', '&', '&'] + domain
        self.assertEqual(norm_domain, expression.normalize_domain(domain), "Non-normalized domains should be properly normalized")

    def test_40_negating_long_expression(self):
        source = ['!', '&', ('user_id', '=', 4), ('test_base_model_id', 'in', [1, 2])]
        expect = ['|', ('user_id', '!=', 4), ('test_base_model_id', 'not in', [1, 2])]
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
        TestbaseModel = self.env['test_base.model']
        helene = TestbaseModel.create({'name': u'Hélène'})
        self.assertEqual(helene, TestbaseModel.search([('name','ilike','Helene')]))
        self.assertEqual(helene, TestbaseModel.search([('name','ilike','hélène')]))
        self.assertNotIn(helene, TestbaseModel.search([('name','not ilike','Helene')]))
        self.assertNotIn(helene, TestbaseModel.search([('name','not ilike','hélène')]))

    def test_like_wildcards(self):
        # check that =like/=ilike expressions are working on an untranslated field
        TestMany2one = self.env['test_base.many2one']
        test_many2one = TestMany2one.search([('name', '=like', 'M_O')])
        self.assertTrue(len(test_many2one) == 1, "Must match one test_base.many2one (M2O)")
        test_many2one = TestMany2one.search([('name', '=ilike', 'M%')])
        self.assertTrue(len(test_many2one) >= 1, "Must match one test_base.many2one (M2O)")

        # check that =like/=ilike expressions are working on translated field
        TestbaseModel = self.env['test_base.model']
        test_base_models = TestbaseModel.search([('name', '=like', 'P__e_t1')])
        self.assertTrue(len(test_base_models) == 1, "Must match Parent1 only")
        test_base_models = TestbaseModel.search([('name', '=ilike', 'P%')])
        self.assertTrue(len(test_base_models) == 2, "Must match only with test data Parent1 and Parent2")

    def test_translate_search(self):
        TestbaseModel = self.env['test_base.model']
        test_base_model_belgium = self.env.ref('test_base.test_base_model_belgium')
        domains = [
            [('name', '=', 'Belgium')],
            [('name', 'ilike', 'Belg')],
            [('name', 'in', ['Belgium', 'Care Bears'])],
        ]

        for domain in domains:
            test_base_models = TestbaseModel.search(domain)
            self.assertEqual(test_base_models, test_base_model_belgium)

    def test_long_table_alias(self):
        # To test the 64 characters limit for table aliases in PostgreSQL
        self.patch_order('res.users', 'partner_id')
        self.patch_order('res.partner', 'commercial_partner_id,company_id,name')
        self.patch_order('res.company', 'parent_id')
        self.env['res.users'].search([('name', '=', 'test')])

    @mute_logger('odoo.sql_db')
    def test_invalid(self):
        """ verify that invalid expressions are refused, even for magic fields """
        TestbaseModel = self.env['test_base.model']

        with self.assertRaises(ValueError):
            TestbaseModel.search([('does_not_exist', '=', 'foo')])

        with self.assertRaises(ValueError):
            TestbaseModel.search([('create_date', '>>', 'foo')])

        with self.assertRaises(psycopg2.DataError):
            TestbaseModel.search([('create_date', '=', "1970-01-01'); --")])

    def test_active(self):
        # testing for many2many field with many2one_id test and active=False
        TestbaseModel = self.env['test_base.model']
        vals = {
            'name': 'OpenERP Test',
            'active': False,
            'many2many_ids': [(6, 0, [self.ref("test_base.many2many_test")])],
            'child_ids': [(0, 0, {'name': 'address of OpenERP Test', 'many2one_id': self.ref("test_base.many2one_test")})],
        }
        TestbaseModel.create(vals)
        test_base_models = TestbaseModel.search([('many2many_ids', 'ilike', 'M2M'), ('active', '=', False)])
        self.assertTrue(test_base_models, "Record not Found with category vendor and active False.")

        # testing for one2many field with test 2 M2O and active=False
        test_base_models = TestbaseModel.search([('child_ids.many2one_id','=','M2O'),('active','=',False)])
        self.assertTrue(test_base_models, "Record not Found with name M2O and active False.")

    def test_lp1071710(self):
        """ Check that we can exclude translated fields (bug lp:1071710) """
        # first install french language
        self.env['ir.translation'].load_module_terms(['test_base'], ['fr_FR'])
        # actual test
        TestbaseModel = self.env['test_base.model']
        be = self.env.ref('test_base.test_base_model_belgium')
        not_be = TestbaseModel.with_context(lang='fr_FR').search([('name', '!=', 'Belgique')])
        self.assertNotIn(be, not_be)

        # indirect search via m2o
        TestOne2many = self.env['test_base.one2many']
        o2m = TestOne2many.search([('login', '=', 'Belgium')])

        not_be = TestOne2many.search([('test_base_model_id', '!=', 'Belgium')])
        self.assertNotIn(o2m, not_be)

        not_be = TestOne2many.with_context(lang='fr_FR').search([('test_base_model_id', '!=', 'Belgique')])
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
        TestbaseModel = self.env['test_base.model']
        TestMany2one = self.env['test_base.many2one']
        TestOne2many = self.env['test_base.one2many']

        # Get test columns
        def patch_auto_join(model, fname, value):
            self.patch(model._fields[fname], 'auto_join', value)

        def patch_domain(model, fname, value):
            self.patch(model._fields[fname], 'domain', value)

        # Get child M2O/M2O data
        child_m2o = self.env['test_base.child.many2one'].search([('name', 'like', 'Child M2O')], limit=1)
        m2os = self.env['test_base.many2one'].search([('child_m2o_id', '=', child_m2o.id)], limit=2)

        # Create test data: test_base_models and test_base_one2many object
        test_base_model_a = TestbaseModel.create({'name': 'test__A', 'many2one_id': m2os[0].id})
        test_base_model_b = TestbaseModel.create({'name': 'test__B', 'many2one_id': m2os[1].id})
        test_base_model_aa = TestbaseModel.create({'name': 'test__AA', 'parent_id': test_base_model_a.id, 'many2one_id': m2os[0].id})
        test_base_model_ab = TestbaseModel.create({'name': 'test__AB', 'parent_id': test_base_model_a.id, 'many2one_id': m2os[1].id})
        test_base_model_ba = TestbaseModel.create({'name': 'test__BA', 'parent_id': test_base_model_b.id, 'many2one_id': m2os[0].id})
        o2m_aa = TestOne2many.create({'login': '123','test_base_model_id': test_base_model_aa.id})
        o2m_ab = TestOne2many.create({'login': '456', 'test_base_model_id': test_base_model_ab.id})
        o2m_ba = TestOne2many.create({'login': '789', 'test_base_model_id': test_base_model_ba.id})

        # --------------------------------------------------
        # Test1: basics about the attribute
        # --------------------------------------------------

        patch_auto_join(TestbaseModel, 'many2many_ids', True)
        with self.assertRaises(NotImplementedError):
            TestbaseModel.search([('many2many_ids.name', '=', 'foo')])

        # --------------------------------------------------
        # Test2: one2many
        # --------------------------------------------------

        name_test = '12'
        # Do: one2many without _auto_join
        patch_auto_join(TestbaseModel, 'one2many_ids', False)
        self._reinit_mock()
        test_base_models = TestbaseModel.search([('one2many_ids.login', 'like', name_test)])
        # Test result
        self.assertEqual(test_base_models, test_base_model_aa,
            "_auto_join off: ('one2many_ids.login', 'like', '..'): incorrect result")
        # Test produced queries
        self.assertEqual(len(self.query_list), 2,
            "_auto_join off: ('one2many_ids.login', 'like', '..') should produce 2 queries (1 in test_base_one2many, 1 on test_base)")
        sql_query = self.query_list[0].get_sql()
        self.assertIn('test_base_one2many', sql_query[0],
            "_auto_join off: ('one2many_ids.login', 'like', '..') first query incorrect main table")

        expected = "%s like %s" % (unaccent('"test_base_one2many"."login"::text'), unaccent('%s'))
        self.assertIn(expected, sql_query[1],
            "_auto_join off: ('one2many_ids.login', 'like', '..') first query incorrect where condition")

        self.assertEqual([True ,'%' + name_test + '%'], sql_query[2],
            "_auto_join off: ('one2many_ids.login', 'like', '..') first query incorrect parameter")
        sql_query = self.query_list[1].get_sql()
        self.assertIn('test_base', sql_query[0],
            "_auto_join off: ('one2many_ids.login', 'like', '..') second query incorrect main table")
        self.assertIn('"test_base_model"."id" in (%s)', sql_query[1],
            "_auto_join off: ('one2many_ids.login', 'like', '..') second query incorrect where condition")
        self.assertIn(test_base_model_aa.id, sql_query[2],
            "_auto_join off: ('one2many_ids.login', 'like', '..') second query incorrect parameter")

        # Do: cascaded one2many without _auto_join
        self._reinit_mock()
        test_base_models = TestbaseModel.search([('child_ids.one2many_ids.id', 'in', [o2m_aa.id, o2m_ba.id])])
        # Test result
        self.assertEqual(test_base_models, test_base_model_a + test_base_model_b,
            "_auto_join off: ('child_ids.one2many_ids.id', 'in', [..]): incorrect result")
        # Test produced queries
        self.assertEqual(len(self.query_list), 3,
            "_auto_join off: ('child_ids.one2many_ids.id', 'in', [..]) should produce 3 queries (1 in test_base_one2many, 2 on test_base)")

        # Do: one2many with _auto_join
        patch_auto_join(TestbaseModel, 'one2many_ids', True)
        self._reinit_mock()
        test_base_models = TestbaseModel.search([('one2many_ids.login', 'like', name_test)])
        # Test result
        self.assertEqual(test_base_models, test_base_model_aa,
            "_auto_join on: ('one2many_ids.login', 'like', '..') incorrect result")
        # Test produced queries
        self.assertEqual(len(self.query_list), 1,
            "_auto_join on: ('one2many_ids.login', 'like', '..') should produce 1 query")
        sql_query = self.query_list[0].get_sql()
        self.assertIn('"test_base_model"', sql_query[0],
            "_auto_join on: ('one2many_ids.login', 'like', '..') query incorrect main table")
        self.assertIn('"test_base_one2many" as "test_base_model__one2many_ids"', sql_query[0],
            "_auto_join on: ('one2many_ids.login', 'like', '..') query incorrect join")

        expected = "%s like %s" % (unaccent('"test_base_model__one2many_ids"."login"::text'), unaccent('%s'))
        self.assertIn(expected, sql_query[1],
            "_auto_join on: ('one2many_ids.login', 'like', '..') query incorrect where condition")

        self.assertIn('"test_base_model"."id"="test_base_model__one2many_ids"."test_base_model_id"', sql_query[1],
            "_auto_join on: ('one2many_ids.login', 'like', '..') query incorrect join condition")
        self.assertIn('%' + name_test + '%', sql_query[2],
            "_auto_join on: ('one2many_ids.login', 'like', '..') query incorrect parameter")

        # Do: one2many with _auto_join, test final leaf is an id
        self._reinit_mock()
        o2m_ids = [o2m_aa.id, o2m_ab.id]
        test_base_models = TestbaseModel.search([('one2many_ids.id', 'in', o2m_ids)])
        # Test result
        self.assertEqual(test_base_models, test_base_model_aa + test_base_model_ab,
            "_auto_join on: ('one2many_ids.id', 'in', [..]) incorrect result")
        # Test produced queries
        self.assertEqual(len(self.query_list), 1,
            "_auto_join on: ('one2many_ids.id', 'in', [..]) should produce 1 query")
        sql_query = self.query_list[0].get_sql()
        self.assertIn('"test_base_model"', sql_query[0],
            "_auto_join on: ('one2many_ids.id', 'in', [..]) query incorrect main table")
        self.assertIn('"test_base_model__one2many_ids"."id" in (%s,%s)', sql_query[1],
            "_auto_join on: ('one2many_ids.id', 'in', [..]) query incorrect where condition")
        self.assertLessEqual(set(o2m_ids), set(sql_query[2]),
            "_auto_join on: ('one2many_ids.id', 'in', [..]) query incorrect parameter")

        # Do: 2 cascaded one2many with _auto_join, test final leaf is an id
        patch_auto_join(TestbaseModel, 'child_ids', True)
        self._reinit_mock()
        o2m_ids = [o2m_aa.id, o2m_ba.id]
        test_base_models = TestbaseModel.search([('child_ids.one2many_ids.id', 'in', o2m_ids)])
        # Test result
        self.assertEqual(test_base_models, test_base_model_a + test_base_model_b,
            "_auto_join on: ('child_ids.one2many_ids.id', 'not in', [..]): incorrect result")
        # # Test produced queries
        self.assertEqual(len(self.query_list), 1,
            "_auto_join on: ('child_ids.one2many_ids.id', 'in', [..]) should produce 1 query")
        sql_query = self.query_list[0].get_sql()
        self.assertIn('"test_base_model"', sql_query[0],
            "_auto_join on: ('child_ids.one2many_ids.id', 'in', [..]) incorrect main table")
        self.assertIn('"test_base_model" as "test_base_model__child_ids"', sql_query[0],
            "_auto_join on: ('child_ids.one2many_ids.id', 'in', [..]) query incorrect join")
        self.assertIn('"test_base_one2many" as "test_base_model__child_ids__one2many_ids"', sql_query[0],
            "_auto_join on: ('child_ids.one2many_ids.id', 'in', [..]) query incorrect join")
        self.assertIn('"test_base_model__child_ids__one2many_ids"."id" in (%s,%s)', sql_query[1],
            "_auto_join on: ('child_ids.one2many_ids.id', 'in', [..]) query incorrect where condition")
        self.assertIn('"test_base_model"."id"="test_base_model__child_ids"."parent_id"', sql_query[1],
            "_auto_join on: ('child_ids.one2many_ids.id', 'in', [..]) query incorrect join condition")
        self.assertIn('"test_base_model__child_ids"."id"="test_base_model__child_ids__one2many_ids"."test_base_model_id"', sql_query[1],
            "_auto_join on: ('child_ids.one2many_ids.id', 'in', [..]) query incorrect join condition")
        self.assertLessEqual(set(o2m_ids), set(sql_query[2][-2:]),
            "_auto_join on: ('child_ids.one2many_ids.id', 'in', [..]) query incorrect parameter")

        # --------------------------------------------------
        # Test3: many2one
        # --------------------------------------------------
        name_test = 'Child M2O'

        # Do: many2one without _auto_join
        self._reinit_mock()
        test_base_models = TestbaseModel.search([('many2one_id.child_m2o_id.name', 'like', name_test)])
        # Test result: at least our added data + test data
        self.assertLessEqual(test_base_model_a + test_base_model_b + test_base_model_aa + test_base_model_ab + test_base_model_ba, test_base_models,
            "_auto_join off: ('many2one_id.child_m2o_id.name', 'like', '..') incorrect result")
        # Test produced queries
        self.assertEqual(len(self.query_list), 3,
            "_auto_join off: ('many2one_id.child_m2o_id.name', 'like', '..') should produce 3 queries (1 on test_base_child_many2one, 1 on test_base_many2one, 1 on test_base)")

        # Do: many2one with 1 _auto_join on the first many2one
        patch_auto_join(TestbaseModel, 'many2one_id', True)
        self._reinit_mock()
        test_base_models = TestbaseModel.search([('many2one_id.child_m2o_id.name', 'like', name_test)])
        # Test result: at least our added data + test data
        self.assertLessEqual(test_base_model_a + test_base_model_b + test_base_model_aa + test_base_model_ab + test_base_model_ba, test_base_models,
            "_auto_join on for many2one_id: ('many2one_id.child_m2o_id.name', 'like', '..') incorrect result")
        # Test produced queries
        self.assertEqual(len(self.query_list), 2,
            "_auto_join on for many2one_id: ('many2one_id.child_m2o_id.name', 'like', '..') should produce 2 query")
        sql_query = self.query_list[0].get_sql()
        self.assertIn('"test_base_child_many2one"', sql_query[0],
            "_auto_join on for many2one_id: ('many2one_id.child_m2o_id.name', 'like', '..') query 1 incorrect main table")

        expected = "%s like %s" % (unaccent('"test_base_child_many2one"."name"::text'), unaccent('%s'))
        self.assertIn(expected, sql_query[1],
            "_auto_join on for many2one_id: ('many2one_id.child_m2o_id.name', 'like', '..') query 1 incorrect where condition")

        self.assertEqual(['%' + name_test + '%'], sql_query[2],
            "_auto_join on for many2one_id: ('many2one_id.child_m2o_id.name', 'like', '..') query 1 incorrect parameter")
        sql_query = self.query_list[1].get_sql()
        self.assertIn('"test_base_model"', sql_query[0],
            "_auto_join on for many2one_id: ('many2one_id.child_m2o_id.name', 'like', '..') query 2 incorrect main table")
        self.assertIn('"test_base_many2one" as "test_base_model__many2one_id"', sql_query[0],
            "_auto_join on for many2one_id: ('many2one_id.child_m2o_id.name', 'like', '..') query 2 incorrect join")
        self.assertIn('"test_base_model__many2one_id"."child_m2o_id" in (%s)', sql_query[1],
            "_auto_join on for many2one_id: ('many2one_id.child_m2o_id.name', 'like', '..') query 2 incorrect where condition")
        self.assertIn('"test_base_model"."many2one_id"="test_base_model__many2one_id"."id"', sql_query[1],
            "_auto_join on for many2one_id: ('many2one_id.child_m2o_id.name', 'like', '..') query 2 incorrect join condition")

        # Do: many2one with 1 _auto_join on the second many2one
        patch_auto_join(TestbaseModel, 'many2one_id', False)
        patch_auto_join(TestMany2one, 'child_m2o_id', True)
        self._reinit_mock()
        test_base_models = TestbaseModel.search([('many2one_id.child_m2o_id.name', 'like', name_test)])
        # Test result: at least our added data + test data
        self.assertLessEqual(test_base_model_a + test_base_model_b + test_base_model_aa + test_base_model_ab + test_base_model_ba, test_base_models,
            "_auto_join on for child_m2o_id: ('many2one_id.child_m2o_id.name', 'like', '..') incorrect result")
        # Test produced queries
        self.assertEqual(len(self.query_list), 2,
            "_auto_join on for child_m2o_id: ('many2one_id.child_m2o_id.name', 'like', '..') should produce 2 query")
        # -- first query
        sql_query = self.query_list[0].get_sql()
        self.assertIn('"test_base_child_many2one"', sql_query[0],
            "_auto_join on for child_m2o_id: ('many2one_id.child_m2o_id.name', 'like', '..') query 1 incorrect main table")
        self.assertIn('"test_base_child_many2one" as "test_base_many2one__child_m2o_id"', sql_query[0],
            "_auto_join on for child_m2o_id: ('many2one_id.child_m2o_id.name', 'like', '..') query 1 incorrect join")

        expected = "%s like %s" % (unaccent('"test_base_many2one__child_m2o_id"."name"::text'), unaccent('%s'))
        self.assertIn(expected, sql_query[1],
            "_auto_join on for child_m2o_id: ('many2one_id.child_m2o_id.name', 'like', '..') query 1 incorrect where condition")

        self.assertIn('"test_base_many2one"."child_m2o_id"="test_base_many2one__child_m2o_id"."id"', sql_query[1],
            "_auto_join on for child_m2o_id: ('many2one_id.child_m2o_id.name', 'like', '..') query 1 incorrect join condition")
        self.assertEqual(['%' + name_test + '%'], sql_query[2],
            "_auto_join on for child_m2o_id: ('many2one_id.child_m2o_id.name', 'like', '..') query 1 incorrect parameter")
        # -- second query
        sql_query = self.query_list[1].get_sql()
        self.assertIn('"test_base_model"', sql_query[0],
            "_auto_join on for child_m2o_id: ('many2one_id.child_m2o_id.name', 'like', '..') query 2 incorrect main table")
        self.assertIn('"test_base_model"."many2one_id" in', sql_query[1],
            "_auto_join on for child_m2o_id: ('many2one_id.child_m2o_id.name', 'like', '..') query 2 incorrect where condition")

        # Do: many2one with 2 _auto_join
        patch_auto_join(TestbaseModel, 'many2one_id', True)
        patch_auto_join(TestMany2one, 'child_m2o_id', True)
        self._reinit_mock()
        test_base_models = TestbaseModel.search([('many2one_id.child_m2o_id.name', 'like', name_test)])
        # Test result: at least our added data + test data
        self.assertLessEqual(test_base_model_a + test_base_model_b + test_base_model_aa + test_base_model_ab + test_base_model_ba, test_base_models,
            "_auto_join on: ('many2one_id.child_m2o_id.name', 'like', '..') incorrect result")
        # Test produced queries
        self.assertEqual(len(self.query_list), 1,
            "_auto_join on: ('many2one_id.child_m2o_id.name', 'like', '..') should produce 1 query")
        sql_query = self.query_list[0].get_sql()
        self.assertIn('"test_base_model"', sql_query[0],
            "_auto_join on: ('many2one_id.child_m2o_id.name', 'like', '..') query incorrect main table")
        self.assertIn('"test_base_many2one" as "test_base_model__many2one_id"', sql_query[0],
            "_auto_join on: ('many2one_id.child_m2o_id.name', 'like', '..') query incorrect join")
        self.assertIn('"test_base_child_many2one" as "test_base_model__many2one_id__child_m2o_id"', sql_query[0],
            "_auto_join on: ('many2one_id.child_m2o_id.name', 'like', '..') query incorrect join")

        expected = "%s like %s" % (unaccent('"test_base_model__many2one_id__child_m2o_id"."name"::text'), unaccent('%s'))
        self.assertIn(expected, sql_query[1],
            "_auto_join on: ('many2one_id.child_m2o_id.name', 'like', '..') query incorrect where condition")

        self.assertIn('"test_base_model"."many2one_id"="test_base_model__many2one_id"."id"', sql_query[1],
            "_auto_join on: ('many2one_id.child_m2o_id.name', 'like', '..') query incorrect join condition")
        self.assertIn('"test_base_model__many2one_id"."child_m2o_id"="test_base_model__many2one_id__child_m2o_id"."id"', sql_query[1],
            "_auto_join on: ('many2one_id.child_m2o_id.name', 'like', '..') query incorrect join condition")
        self.assertIn('%' + name_test + '%', sql_query[2],
            "_auto_join on: ('many2one_id.child_m2o_id.name', 'like', '..') query incorrect parameter")

        # --------------------------------------------------
        # Test4: domain attribute on one2many fields
        # --------------------------------------------------

        patch_auto_join(TestbaseModel, 'child_ids', True)
        patch_auto_join(TestbaseModel, 'one2many_ids', True)
        patch_domain(TestbaseModel, 'child_ids', lambda self: ['!', ('name', '=', self._name)])
        patch_domain(TestbaseModel, 'one2many_ids', [('login', 'like', '2')])
        self.patch(TestbaseModel._fields['name'], 'translate', False)
        # Do: 2 cascaded one2many with _auto_join, test final leaf is an id
        self._reinit_mock()
        test_base_models = TestbaseModel.search(['!', ('name', '=', 'HGFDFGHGFD') ,'&', (1, '=', 1), ('child_ids.one2many_ids.id', 'in', [o2m_aa.id, o2m_ba.id])])
        # Test result: at least one of our added data
        self.assertLessEqual(test_base_model_a, test_base_models,
            "_auto_join on one2many with domains incorrect result")
        self.assertFalse((test_base_model_ab + test_base_model_ba) & test_base_models,
            "_auto_join on one2many with domains incorrect result")
        # Test produced queries that domains effectively present
        sql_query = self.query_list[0].get_sql()

        expected = "%s like %s" % (unaccent('"test_base_model__child_ids__one2many_ids"."login"::text'), unaccent('%s'))
        self.assertIn(expected, sql_query[1],
            "_auto_join on one2many with domains incorrect result")
        # TDE TODO: check first domain has a correct table name
        self.assertIn('"test_base_model__child_ids"."name" = %s', sql_query[1],
            "_auto_join on one2many with domains incorrect result")

        patch_domain(TestbaseModel, 'child_ids', lambda self: [('name', '=', '__%s' % self._name)])
        self._reinit_mock()
        test_base_models = TestbaseModel.search(['&', (1, '=', 1), ('child_ids.one2many_ids.id', 'in', [o2m_aa.id, o2m_ba.id])])
        # Test result: no one
        self.assertFalse(test_base_models,
            "_auto_join on one2many with domains incorrect result")

        # ----------------------------------------
        # Test5: result-based tests
        # ----------------------------------------

        patch_auto_join(TestbaseModel, 'one2many_ids', False)
        patch_auto_join(TestbaseModel, 'child_ids', False)
        patch_auto_join(TestbaseModel, 'many2one_id', False)
        patch_auto_join(TestbaseModel, 'parent_id', False)
        patch_auto_join(TestMany2one, 'child_m2o_id', False)
        patch_domain(TestbaseModel, 'child_ids', [])
        patch_domain(TestbaseModel, 'one2many_ids', [])

        # Do: ('child_ids.many2one_id.child_m2o_id.name', 'like', '..') without _auto_join
        self._reinit_mock()
        test_base_models = TestbaseModel.search([('child_ids.many2one_id.child_m2o_id.name', 'like', name_test)])
        # Test result: at least our added data + test data
        self.assertLessEqual(test_base_model_a + test_base_model_b, test_base_models,
            "_auto_join off: ('child_ids.many2one_id.child_m2o_id.name', 'like', '..') incorrect result")
        # Test produced queries
        self.assertEqual(len(self.query_list), 4,
            "_auto_join off: ('child_ids.many2one_id.child_m2o_id.name', 'like', '..') number of queries incorrect")

        # Do: ('child_ids.many2one_id.child_m2o_id.name', 'like', '..') with _auto_join
        patch_auto_join(TestbaseModel, 'child_ids', True)
        patch_auto_join(TestbaseModel, 'many2one_id', True)
        patch_auto_join(TestMany2one, 'child_m2o_id', True)
        self._reinit_mock()
        test_base_models = TestbaseModel.search([('child_ids.many2one_id.child_m2o_id.name', 'like', name_test)])
        # Test result: at least our added data + test data
        self.assertLessEqual(test_base_model_a + test_base_model_b, test_base_models,
            "_auto_join on: ('child_ids.many2one_id.child_m2o_id.code', 'like', '..') incorrect result")
        # Test produced queries
        self.assertEqual(len(self.query_list), 1,
            "_auto_join on: ('child_ids.many2one_id.child_m2o_id.name', 'like', '..') number of queries incorrect")
