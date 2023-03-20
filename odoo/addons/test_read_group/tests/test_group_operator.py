# -*- coding: utf-8 -*-
from odoo.tests import common


class TestGroupBooleans(common.TransactionCase):

    def setUp(self):
        super(TestGroupBooleans, self).setUp()
        self.Model = self.env['test_read_group.aggregate.boolean']

    def test_no_value(self):
        groups = self.Model.read_group(
            domain=[],
            groupby=['key'],
            aggregates=['bool_and:bool_and', 'bool_or:bool_or', 'bool_array:array_agg'],
        )

        self.assertEqual([], groups)

    def test_agg_and(self):
        # and(true, true)
        self.Model.create({
            'key': 1,
            'bool_and': True
        })
        self.Model.create({
            'key': 1,
            'bool_and': True
        })
        # and(true, false)
        self.Model.create({'key': 2, 'bool_and': True})
        self.Model.create({'key': 2, 'bool_and': False})
        # and(false, false)
        self.Model.create({'key': 3, 'bool_and': False})
        self.Model.create({'key': 3, 'bool_and': False})

        groups = self.Model.read_group(
            domain=[],
            aggregates=['bool_and:bool_and'],
            groupby=['key'],
        )

        self.assertEqual([
            {
                '__count': 2,
                '__domain': [('key', '=', 1)],
                'key': 1,
                'bool_and:bool_and': True
            },
            {
                '__count': 2,
                '__domain': [('key', '=', 2)],
                'key': 2,
                'bool_and:bool_and': False
            },
            {
                '__count': 2,
                '__domain': [('key', '=', 3)],
                'key': 3,
                'bool_and:bool_and': False
            },
        ], groups)


    def test_agg_or(self):
        # or(true, true)
        self.Model.create({'key': 1, 'bool_or': True})
        self.Model.create({'key': 1, 'bool_or': True})
        # or(true, false)
        self.Model.create({'key': 2, 'bool_or': True})
        self.Model.create({'key': 2, 'bool_or': False})
        # or(false, false)
        self.Model.create({'key': 3, 'bool_or': False})
        self.Model.create({'key': 3, 'bool_or': False})

        groups = self.Model.read_group(
            domain=[],
            aggregates=['bool_or:bool_or'],
            groupby=['key'],
        )

        self.assertEqual([
            {
                '__count': 2,
                '__domain': [('key', '=', 1)],
                'key': 1,
                'bool_or:bool_or': True
            },
            {
                '__count': 2,
                '__domain': [('key', '=', 2)],
                'key': 2,
                'bool_or:bool_or': True
            },
            {
                '__count': 2,
                '__domain': [('key', '=', 3)],
                'key': 3,
                'bool_or:bool_or': False
            },
        ], groups)

    def test_agg_array(self):
        # array(true, true)
        self.Model.create({'key': 1, 'bool_array': True})
        self.Model.create({'key': 1, 'bool_array': True})
        # array(true, false)
        self.Model.create({'key': 2, 'bool_array': True})
        self.Model.create({'key': 2, 'bool_array': False})
        # array(false, false)
        self.Model.create({'key': 3, 'bool_array': False})
        self.Model.create({'key': 3, 'bool_array': False})

        groups = self.Model.read_group(
            domain=[],
            aggregates=['bool_array:array_agg'],
            groupby=['key'],
        )

        self.assertEqual([
            {
                '__count': 2,
                '__domain': [('key', '=', 1)],
                'key': 1,
                'bool_array:array_agg': [True, True]
            },
            {
                '__count': 2,
                '__domain': [('key', '=', 2)],
                'key': 2,
                'bool_array:array_agg': [True, False]
            },
            {
                '__count': 2,
                '__domain': [('key', '=', 3)],
                'key': 3,
                'bool_array:array_agg': [False, False]
            },
        ], groups)

    def test_group_by_aggregable(self):
        self.Model.create({'bool_and': False, 'key': 1, 'bool_array': True})
        self.Model.create({'bool_and': False, 'key': 2, 'bool_array': True})
        self.Model.create({'bool_and': False, 'key': 2, 'bool_array': True})
        self.Model.create({'bool_and': True, 'key': 2, 'bool_array': True})
        self.Model.create({'bool_and': True, 'key': 3, 'bool_array': True})
        self.Model.create({'bool_and': True, 'key': 3, 'bool_array': True})

        groups = self.Model.read_group(
            domain=[],
            aggregates=['bool_array:array_agg'],
            groupby=['bool_and', 'key'],
            lazy=False
        )

        self.assertEqual([
            {
                'bool_and': False,
                'key': 1,
                'bool_array:array_agg': [True],
                '__count': 1,
                '__domain': ['&', ('bool_and', '=', False), ('key', '=', 1)]
            },
            {
                'bool_and': False,
                'key': 2,
                'bool_array:array_agg': [True, True],
                '__count': 2,
                '__domain': ['&', ('bool_and', '=', False), ('key', '=', 2)]

            },
            {
                'bool_and': True,
                'key': 2,
                'bool_array:array_agg': [True],
                '__count': 1,
                '__domain': ['&', ('bool_and', '=', True), ('key', '=', 2)]
            },
            {
                'bool_and': True,
                'key': 3,
                'bool_array:array_agg': [True, True],
                '__count': 2,
                '__domain': ['&', ('bool_and', '=', True), ('key', '=', 3)]
            }
        ], groups)


class TestAggregate(common.TransactionCase):
    def setUp(self):
        super(TestAggregate, self).setUp()

        self.foo = self.env['res.partner'].create({'name': 'Foo'})
        self.bar = self.env['res.partner'].create({'name': 'Bar'})

        self.Model = self.env['test_read_group.aggregate']
        self.Model.create({'key': 1, 'value': 1, 'partner_id': False})
        self.Model.create({'key': 1, 'value': 2, 'partner_id': self.foo.id})
        self.Model.create({'key': 1, 'value': 3, 'partner_id': self.foo.id})
        self.Model.create({'key': 1, 'value': 4, 'partner_id': self.bar.id})

    def test_agg_default(self):
        """ test default aggregation on fields """
        fields = ['value', 'partner_id']
        groups = self.Model.read_group([], ['key'], fields)
        self.assertEqual(groups, [{
            'key': 1,
            'value': 10,
            '__count': 4,
            '__domain': [('key', '=', 1)],
        }])

    def test_agg_explicit(self):
        """ test explicit aggregation on fields """
        fields = ['value:max', 'partner_id']
        groups = self.Model.read_group([], ['key'], fields)
        self.assertEqual(groups, [{
            'key': 1,
            'value:max': 4,
            '__count': 4,
            '__domain': [('key', '=', 1)],
        }])
        fields = ['value:sum', 'partner_id:array_agg']
        groups = self.Model.read_group([], ['key'], fields)
        self.assertEqual(groups, [{
            'key': 1,
            'value:sum': 10,
            'partner_id:array_agg': [None, self.foo.id, self.foo.id, self.bar.id],
            '__count': 4,
            '__domain': [('key', '=', 1)],
        }])
        fields = ['value:sum', 'partner_id:count']
        groups = self.Model.read_group([], ['key'], fields)
        self.assertEqual(groups, [{
            'key': 1,
            'value:sum': 10,
            'partner_id:count': 3,
            '__count': 4,
            '__domain': [('key', '=', 1)],
        }])
        fields = ['value:sum', 'partner_id:count_distinct']
        groups = self.Model.read_group([], ['key'], fields)
        self.assertEqual(groups, [{
            'key': 1,
            'value:sum': 10,
            'partner_id:count_distinct': 2,
            '__count': 4,
            '__domain': [('key', '=', 1)],
        }])

    def test_agg_multi(self):
        """ test multiple aggregation on fields """
        fields = ['value:min', 'value:max', 'partner_id']
        groups = self.Model.read_group([], ['key'], fields)
        self.assertEqual(groups, [{
            'key': 1,
            'value:min': 1,
            'value:max': 4,
            '__count': 4,
            '__domain': [('key', '=', 1)],
        }])

        fields = ['id:array_agg']
        groups = self.Model.read_group([], ['key'], fields)
        self.assertEqual(groups, [{
            'key': 1,
            'id:array_agg': self.Model.search([]).ids,
            '__count': 4,
            '__domain': [('key', '=', 1)],
        }])
