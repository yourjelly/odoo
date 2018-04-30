# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models
from odoo.tools import mute_logger, pycompat
from odoo.exceptions import AccessError
from odoo.addons.test_base.tests.common import TransactionCaseCommon


class TestAPI(TransactionCaseCommon):
    """ test the new API of the ORM """

    def assertIsRecordset(self, value, model):
        self.assertIsInstance(value, models.BaseModel)
        self.assertEqual(value._name, model)

    def assertIsRecord(self, value, model):
        self.assertIsRecordset(value, model)
        self.assertTrue(len(value) <= 1)

    def assertIsNull(self, value, model):
        self.assertIsRecordset(value, model)
        self.assertFalse(value)

    @mute_logger('odoo.models')
    def test_00_query(self):
        """ Build a recordset, and check its contents. """
        domain = [('name', 'ilike', 'p')]
        test_base_models = self.env['test_base.model'].search(domain)

        # test_base_models is a collection of browse records
        self.assertTrue(test_base_models)

        # test_base_models and its contents are instance of the model
        self.assertIsRecordset(test_base_models, 'test_base.model')
        for test_base_model in test_base_models:
            self.assertIsRecord(test_base_model, 'test_base.model')

    @mute_logger('odoo.models')
    def test_01_query_offset(self):
        """ Build a recordset with offset, and check equivalence. """
        test_base_models1 = self.env['test_base.model'].search([], offset=10)
        test_base_models2 = self.env['test_base.model'].search([])[10:]
        self.assertIsRecordset(test_base_models1, 'test_base.model')
        self.assertIsRecordset(test_base_models2, 'test_base.model')
        self.assertEqual(list(test_base_models1), list(test_base_models2))

    @mute_logger('odoo.models')
    def test_02_query_limit(self):
        """ Build a recordset with offset, and check equivalence. """
        test_base_models1 = self.env['test_base.model'].search([], limit=10)
        test_base_models2 = self.env['test_base.model'].search([])[:10]
        self.assertIsRecordset(test_base_models1, 'test_base.model')
        self.assertIsRecordset(test_base_models2, 'test_base.model')
        self.assertEqual(list(test_base_models1), list(test_base_models2))

    @mute_logger('odoo.models')
    def test_03_query_offset_limit(self):
        """ Build a recordset with offset and limit, and check equivalence. """
        test_base_models1 = self.env['test_base.model'].search([], offset=3, limit=7)
        test_base_models2 = self.env['test_base.model'].search([])[3:10]
        self.assertIsRecordset(test_base_models1, 'test_base.model')
        self.assertIsRecordset(test_base_models2, 'test_base.model')
        self.assertEqual(list(test_base_models1), list(test_base_models2))

    @mute_logger('odoo.models')
    def test_04_query_count(self):
        """ Test the search method with count=True and search_count. """
        self.cr.execute("SELECT COUNT(*) FROM test_base_model WHERE active")
        count1 = self.cr.fetchone()[0]
        count2 = self.env['test_base.model'].search([], count=True)
        count3 = self.env['test_base.model'].search_count([])
        self.assertIsInstance(count1, pycompat.integer_types)
        self.assertIsInstance(count2, pycompat.integer_types)
        self.assertIsInstance(count3, pycompat.integer_types)
        self.assertEqual(count1, count2)
        self.assertEqual(count1, count3)

    @mute_logger('odoo.models')
    def test_05_immutable(self):
        """ Check that a recordset remains the same, even after updates. """
        domain = [('name', 'ilike', 'p')]
        test_base_models = self.env['test_base.model'].search(domain)
        self.assertTrue(test_base_models)
        ids = test_base_models.ids

        # modify those test_base_models, and check that test_base_models has not changed
        test_base_models.write({'active': False})
        self.assertEqual(ids, test_base_models.ids)

        # redo the search, and check that the result is now empty
        test_base_models2 = self.env['test_base.model'].search(domain)
        self.assertFalse(test_base_models2)

    @mute_logger('odoo.models')
    def test_06_fields(self):
        """ Check that relation fields return records, recordsets or nulls. """

        test_base_models = self.env['test_base.model'].search([])
        for name, field in test_base_models._fields.items():
            if field.type == 'many2one':
                for test_base_model in test_base_models:
                    self.assertIsRecord(test_base_model[name], field.comodel_name)
            elif field.type == 'reference':
                for test_base_model in test_base_models:
                    if test_base_model[name]:
                        self.assertIsRecord(test_base_model[name], field.comodel_name)
            elif field.type in ('one2many', 'many2many'):
                for test_base_model in test_base_models:
                    self.assertIsRecordset(test_base_model[name], field.comodel_name)

    @mute_logger('odoo.models')
    def test_07_null(self):
        """ Check behavior of null instances. """
        # select a test_base_model without a parent
        test_base_model = self.env['test_base.model'].search([('parent_id', '=', False)])[0]

        # check test_base_model and related null instances
        self.assertTrue(test_base_model)
        self.assertIsRecord(test_base_model, 'test_base.model')

        self.assertFalse(test_base_model.parent_id)
        self.assertIsNull(test_base_model.parent_id, 'test_base.model')

        self.assertIs(test_base_model.parent_id.id, False)

        self.assertFalse(test_base_model.parent_id.many2one_id)
        self.assertIsNull(test_base_model.parent_id.many2one_id, 'test_base.many2one')

        self.assertIs(test_base_model.parent_id.many2one_id.name, False)

        self.assertFalse(test_base_model.parent_id.many2one_id.child_m2o_id)
        self.assertIsRecordset(test_base_model.parent_id.many2one_id.child_m2o_id, 'test_base.child.many2one')

    @mute_logger('odoo.models')
    def test_40_new_new(self):
        """ Call new-style methods in the new API style. """
        test_base_models = self.env['test_base.model'].search([('name', 'ilike', 'p')])
        self.assertTrue(test_base_models)

        # call method write on test_base_models itself, and check its effect
        test_base_models.write({'active': False})
        for test_base_model in test_base_models:
            self.assertFalse(test_base_model.active)

    @mute_logger('odoo.models')
    def test_45_new_new(self):
        """ Call new-style methods on records (new API style). """
        test_base_models = self.env['test_base.model'].search([('name', 'ilike', 'p')])
        self.assertTrue(test_base_models)

        # call method write on test_base_model records, and check its effects
        for test_base_model in test_base_models:
            test_base_model.write({'active': False})
        for test_base_model in test_base_models:
            self.assertFalse(test_base_model.active)

    @mute_logger('odoo.models')
    @mute_logger('odoo.addons.base.models.ir_model')
    def test_50_environment(self):
        """ Test environment on records. """
        # test_base_models and reachable records are attached to self.env
        test_base_models = self.env['test_base.model'].search([('name', 'ilike', 'p')])
        self.assertEqual(test_base_models.env, self.env)
        for x in (test_base_models, test_base_models[0], test_base_models[0].many2one_id):
            self.assertEqual(x.env, self.env)
        for test_base_model in test_base_models:
            self.assertEqual(test_base_model.env, self.env)

        # check that the current user can read and modify m2o_group_system_id data
        test_base_models[0].m2o_group_system_id.name
        test_base_models[0].m2o_group_system_id.write({'name': 'Fools'})

        # create an environment with the test user
        test_env = self.env(user = self.user_test)
        self.assertNotEqual(test_env, self.env)

        # test_base_models and related records are still attached to self.env
        self.assertEqual(test_base_models.env, self.env)
        for x in (test_base_models, test_base_models[0], test_base_models[0].many2one_id):
            self.assertEqual(x.env, self.env)
        for test_base_model in test_base_models:
            self.assertEqual(test_base_model.env, self.env)

        # create record instances attached to test_env
        test_user_test_base_models = test_base_models.sudo(self.user_test)
        self.assertEqual(test_user_test_base_models.env, test_env)
        for x in (test_user_test_base_models, test_user_test_base_models[0], test_user_test_base_models[0].many2one_id):
            self.assertEqual(x.env, test_env)
        for test_user_test_base in test_user_test_base_models:
            self.assertEqual(test_user_test_base.env, test_env)

        # demo user can read but not modify company data
        test_user_test_base_models[0].m2o_group_system_id.name
        with self.assertRaises(AccessError):
            test_user_test_base_models[0].m2o_group_system_id.write({'name': 'Pricks'})

        # remove demo user from all groups
        self.user_test.write({'groups_id': [(5,)]})

        # demo user can no longer access only read data
        with self.assertRaises(AccessError):
            test_user_test_base_models[0].m2o_group_system_id.name

    @mute_logger('odoo.models')
    def test_55_draft(self):
        """ Test draft mode nesting. """
        env = self.env
        self.assertFalse(env.in_draft)
        with env.do_in_draft():
            self.assertTrue(env.in_draft)
            with env.do_in_draft():
                self.assertTrue(env.in_draft)
                with env.do_in_draft():
                    self.assertTrue(env.in_draft)
                self.assertTrue(env.in_draft)
            self.assertTrue(env.in_draft)
        self.assertFalse(env.in_draft)

    @mute_logger('odoo.models')
    def test_60_cache(self):
        """ Check the record cache behavior """
        TestBase = self.env['test_base.model']
        test_base_ids = []
        datas = {
            'Test One': ['Test One - One', 'Test One - Two'],
            'Test Two': ['Test Two - One'],
            'Test Three': ['Test Three - One'],
        }
        for name, childs in datas.items():
            test_base_ids.append(TestBase.create({
                'name': name,
                'child_ids': [(0, 0, {'name': c}) for c in childs],
            }).id)

        test_base_models = TestBase.search([('id', 'in', test_base_ids)])
        test_base1, test_base2 = test_base_models[0], test_base_models[1]
        children1, children2 = test_base1.child_ids, test_base2.child_ids
        self.assertTrue(children1)
        self.assertTrue(children2)

        # take a child test_base_models
        child = children1[0]
        self.assertEqual(child.parent_id, test_base1)
        self.assertIn(child, test_base1.child_ids)
        self.assertNotIn(child, test_base2.child_ids)

        # fetch data in the cache
        for test_base_model in test_base_models:
            test_base_model.name, test_base_model.many2one_id.name, test_base_model.color
        self.env.cache.check(self.env)

        # change its parent
        child.write({'parent_id': test_base2.id})
        self.env.cache.check(self.env)

        # check recordsets
        self.assertEqual(child.parent_id, test_base2)
        self.assertNotIn(child, test_base1.child_ids)
        self.assertIn(child, test_base2.child_ids)
        self.assertEqual(set(test_base1.child_ids + child), set(children1))
        self.assertEqual(set(test_base2.child_ids), set(children2 + child))
        self.env.cache.check(self.env)

        # delete it
        child.unlink()
        self.env.cache.check(self.env)

        # check recordsets
        self.assertEqual(set(test_base1.child_ids), set(children1) - set([child]))
        self.assertEqual(set(test_base2.child_ids), set(children2))
        self.env.cache.check(self.env)

        # convert from the cache format to the write format
        test_base_model = test_base1
        test_base_model.many2one_id, test_base_model.child_ids
        data = test_base_model._convert_to_write(test_base_model._cache)
        self.assertEqual(data['many2one_id'], test_base_model.many2one_id.id)
        self.assertEqual(data['child_ids'], [(6, 0, test_base_model.child_ids.ids)])

    @mute_logger('odoo.models')
    def test_60_prefetch(self):
        """ Check the record cache prefetching """
        test_base_models = self.env['test_base.model'].search([], limit=models.PREFETCH_MAX)
        self.assertTrue(len(test_base_models) > 1)

        # all the records in test_base_models are ready for prefetching
        self.assertItemsEqual(test_base_models.ids, test_base_models._prefetch['test_base.model'])

        # reading ONE test_base_models should fetch them ALL
        for test_base_model in test_base_models:
            test_base_model.many2one_id
            break
        test_base_ids_with_field = [test_base_model.id
                                  for test_base_model in test_base_models
                                  if 'many2one_id' in test_base_model._cache]
        self.assertItemsEqual(test_base_ids_with_field, test_base_models.ids)

        # test_base_models' many2one_id are ready for prefetching
        many2one_ids = {m2o_id
                       for test_base_model in test_base_models
                       for m2o_id in test_base_model._cache['many2one_id']}
        self.assertTrue(len(many2one_ids) > 1)
        self.assertItemsEqual(many2one_ids, test_base_models._prefetch['test_base.many2one'])

        # reading ONE test_base_models many2one_id should fetch ALL test_base_models' countries
        for test_base_model in test_base_models:
            if test_base_model.many2one_id:
                test_base_model.many2one_id.name
                break
        many2one_ids_with_field = [m2o.id
                                  for m2o in test_base_models.mapped('many2one_id')
                                  if 'name' in m2o._cache]
        self.assertItemsEqual(many2one_ids_with_field, many2one_ids)

    @mute_logger('odoo.models')
    def test_60_prefetch_object(self):
        """ Check the prefetching model. """
        test_base_models = self.env['test_base.model'].search([], limit=models.PREFETCH_MAX)
        self.assertTrue(test_base_models)

        def same_prefetch(a, b):
            self.assertIs(a._prefetch, b._prefetch)
        def diff_prefetch(a, b):
            self.assertIsNot(a._prefetch, b._prefetch)

        # the recordset operations below should create new prefetch objects
        diff_prefetch(test_base_models, test_base_models.browse())
        diff_prefetch(test_base_models, test_base_models.browse(test_base_models.ids))
        diff_prefetch(test_base_models, test_base_models[0])
        diff_prefetch(test_base_models, test_base_models[:10])

        # the recordset operations below should pass the prefetch object
        same_prefetch(test_base_models, test_base_models.sudo(self.env.ref('base.user_demo')))
        same_prefetch(test_base_models, test_base_models.with_context(active_test=False))
        same_prefetch(test_base_models, test_base_models[:10].with_prefetch(test_base_models._prefetch))

        # iterating and reading relational fields should pass the prefetch object
        self.assertEqual(type(test_base_models).many2one_id.type, 'many2one')
        self.assertEqual(type(test_base_models).child_ids.type, 'one2many')
        self.assertEqual(type(test_base_models).many2many_ids.type, 'many2many')

        vals0 = {
            'name': 'Empty relational fields',
            'many2one_id': False,
            'child_ids': [],
            'many2many_ids': [],
        }
        vals1 = {
            'name': 'Non-empty relational fields',
            'many2one_id': self.ref('test_base.many2one_test'),
            'child_ids': [(0, 0, {'name': 'Child relational'})],
            'many2many_ids': [(4, self.ref('test_base.many2many_test'))],
        }
        test_base_models = test_base_models.create(vals0) + test_base_models.create(vals1)
        for test_base_model in test_base_models:
            same_prefetch(test_base_models, test_base_model)
            same_prefetch(test_base_models, test_base_model.many2one_id)
            same_prefetch(test_base_models, test_base_model.child_ids)
            same_prefetch(test_base_models, test_base_model.many2many_ids)

        # same with empty recordsets
        empty = test_base_model.browse()
        same_prefetch(empty, empty.many2one_id)
        same_prefetch(empty, empty.child_ids)
        same_prefetch(empty, empty.many2many_ids)

    @mute_logger('odoo.models')
    def test_70_one(self):
        """ Check method one(). """
        # check with many records
        test_base_models = self.env['test_base.model'].search([('name', 'ilike', 'p')])
        self.assertTrue(len(test_base_models) > 1)
        with self.assertRaises(ValueError):
            test_base_models.ensure_one()

        test_base1 = test_base_models[0]
        self.assertEqual(len(test_base1), 1)
        self.assertEqual(test_base1.ensure_one(), test_base1)

        test_base0 = self.env['test_base.model'].browse()
        self.assertEqual(len(test_base0), 0)
        with self.assertRaises(ValueError):
            test_base0.ensure_one()

    @mute_logger('odoo.models')
    def test_80_contains(self):
        """ Test membership on recordset. """
        test_base1 = self.env['test_base.model'].search([('name', 'ilike', 'p')], limit=1).ensure_one()
        test_base_models = self.env['test_base.model'].search([('name', 'ilike', 'p')])
        self.assertTrue(test_base1 in test_base_models)

    @mute_logger('odoo.models')
    def test_80_set_operations(self):
        """ Check set operations on recordsets. """
        test_base_models1 = self.env['test_base.model'].search([('name', 'ilike', '1')])
        test_base_models2 = self.env['test_base.model'].search([('name', 'ilike', '2')])
        self.assertTrue(test_base_models1)
        self.assertTrue(test_base_models2)
        self.assertTrue(set(test_base_models1) & set(test_base_models2))

        concat = test_base_models1 + test_base_models2
        self.assertEqual(list(concat), list(test_base_models1) + list(test_base_models2))
        self.assertEqual(len(concat), len(test_base_models1) + len(test_base_models2))

        difference = test_base_models1 - test_base_models2
        self.assertEqual(len(difference), len(set(difference)))
        self.assertEqual(set(difference), set(test_base_models1) - set(test_base_models2))
        self.assertLessEqual(difference, test_base_models1)

        intersection = test_base_models1 & test_base_models2
        self.assertEqual(len(intersection), len(set(intersection)))
        self.assertEqual(set(intersection), set(test_base_models1) & set(test_base_models2))
        self.assertLessEqual(intersection, test_base_models1)
        self.assertLessEqual(intersection, test_base_models2)

        union = test_base_models1 | test_base_models2
        self.assertEqual(len(union), len(set(union)))
        self.assertEqual(set(union), set(test_base_models1) | set(test_base_models2))
        self.assertGreaterEqual(union, test_base_models1)
        self.assertGreaterEqual(union, test_base_models2)

        # one cannot mix different models with set operations
        test_base_models3 = test_base_models1
        other_model = self.env['test_base.many2one'].search([])
        self.assertNotEqual(test_base_models3._name, other_model._name)
        self.assertNotEqual(test_base_models3, other_model)

        with self.assertRaises(TypeError):
            res = test_base_models3 + other_model
        with self.assertRaises(TypeError):
            res = test_base_models3 - other_model
        with self.assertRaises(TypeError):
            res = test_base_models3 & other_model
        with self.assertRaises(TypeError):
            res = test_base_models3 | other_model
        with self.assertRaises(TypeError):
            res = test_base_models3 < other_model
        with self.assertRaises(TypeError):
            res = test_base_models3 <= other_model
        with self.assertRaises(TypeError):
            res = test_base_models3 > other_model
        with self.assertRaises(TypeError):
            res = test_base_models3 >= other_model

    @mute_logger('odoo.models')
    def test_80_filter(self):
        """ Check filter on recordsets. """
        test_base_models = self.env['test_base.model'].search([])
        boolean_true = test_base_models.browse([test_base_model.id for test_base_model in test_base_models if test_base_model.boolean])

        # filter on a single field
        self.assertEqual(test_base_models.filtered(lambda l: l.boolean), boolean_true)
        self.assertEqual(test_base_models.filtered('boolean'), boolean_true)

        # filter on a sequence of fields
        self.assertEqual(
            test_base_models.filtered(lambda l: l.parent_id.boolean),
            test_base_models.filtered('parent_id.boolean')
        )

    @mute_logger('odoo.models')
    def test_80_map(self):
        """ Check map on recordsets. """
        test_base_models = self.env['test_base.model'].search([])
        parents = test_base_models.browse()
        for p in test_base_models: parents |= p.parent_id

        # map a single field
        self.assertEqual(test_base_models.mapped(lambda l: l.parent_id), parents)
        self.assertEqual(test_base_models.mapped('parent_id'), parents)

        # map a sequence of fields
        self.assertEqual(
            test_base_models.mapped(lambda l: l.parent_id.name),
            [test_base_model.parent_id.name for test_base_model in test_base_models]
        )
        self.assertEqual(
            test_base_models.mapped('parent_id.name'),
            [p.name for p in parents]
        )

        # map an empty sequence of fields
        self.assertEqual(test_base_models.mapped(''), test_base_models)

    @mute_logger('odoo.models')
    def test_80_sorted(self):
        """ Check sorted on recordsets. """
        test_base_models = self.env['test_base.model'].search([])

        # sort by model order
        qs = test_base_models[:len(test_base_models) // 2] + test_base_models[len(test_base_models) // 2:]
        self.assertEqual(qs.sorted().ids, test_base_models.ids)

        # sort by name, with a function or a field name
        by_name_ids = [test_base_model.id for test_base_model in sorted(test_base_models, key=lambda b: b.name)]
        self.assertEqual(test_base_models.sorted(lambda l: l.name).ids, by_name_ids)
        self.assertEqual(test_base_models.sorted('name').ids, by_name_ids)

        # sort by inverse name, with a field name
        by_name_ids.reverse()
        self.assertEqual(test_base_models.sorted('name', reverse=True).ids, by_name_ids)
