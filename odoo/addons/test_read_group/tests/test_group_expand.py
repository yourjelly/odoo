# -*- coding: utf-8 -*-
from odoo.tests import common


class TestGroupOnSelection(common.TransactionCase):
    def setUp(self):
        super(TestGroupOnSelection, self).setUp()
        self.Model = self.env['test_read_group.on_selection']

    def test_none(self):
        self.Model.create({'value': 1})
        self.Model.create({'value': 2})
        self.Model.create({'value': 3})

        groups = self.Model.read_group([], aggregates=['value:sum'], groupby=['state'])
        self.assertEqual(groups, [
            {
                'state': 'a',
                '__count': 0,
                'value:sum': False,
                '__domain': [('state', '=', 'a')],
            },
            {
                'state': 'b',
                '__count': 0,
                'value:sum': False,
                '__domain': [('state', '=', 'b')],
            },
            {
                'state': False,
                '__count': 3,
                'value:sum': 6,
                '__domain': [('state', '=', False)],
            },
        ])

    def test_partial(self):
        self.Model.create({'state': 'a', 'value': 1})
        self.Model.create({'state': 'a', 'value': 2})
        self.Model.create({'value': 3})

        groups = self.Model.read_group([], aggregates=['value:sum'], groupby=['state'])
        self.assertEqual(groups, [
            {
                'state': 'a',
                '__count': 2,
                'value:sum': 3,
                '__domain': [('state', '=', 'a')],
            },
            {
                'state': 'b',
                '__count': 0,
                'value:sum': False,
                '__domain': [('state', '=', 'b')],
            },
            {
                'state': False,
                '__count': 1,
                'value:sum': 3,
                '__domain': [('state', '=', False)],
            },
        ])

    def test_full(self):
        self.Model.create({'state': 'a', 'value': 1})
        self.Model.create({'state': 'b', 'value': 2})
        self.Model.create({'value': 3})

        groups = self.Model.read_group([], aggregates=['value:sum'], groupby=['state'])
        self.assertEqual(groups, [
            {
                'state': 'a',
                '__count': 1,
                'value:sum': 1,
                '__domain': [('state', '=', 'a')],
            },
            {
                'state': 'b',
                '__count': 1,
                'value:sum': 2,
                '__domain': [('state', '=', 'b')],
            },
            {
                'state': False,
                '__count': 1,
                'value:sum': 3,
                '__domain': [('state', '=', False)],
            },
        ])


@common.tagged("test_read_group_selection")
class TestSelectionReadGroup(common.TransactionCase):

    def setUp(self):
        super().setUp()
        self.Model = self.env['test_read_group.on_selection']

    def test_static_group_expand(self):
        # this test verifies that the following happens when grouping by a Selection field with
        # group_expand=True:
        #   - the order of the returned groups is the same as the order in which the
        #     options are declared in the field definition.
        #   - the groups returned include the empty groups, i.e. all groups, even those
        #     that have no records assigned to them, this is a (wanted) side-effect of the
        #     implementation.
        #   - the false group, i.e. records without the Selection field set, is last.
        self.Model.create([
            {"value": 1, "static_expand": "a"},
            {"value": 2, "static_expand": "c"},
            {"value": 3},
        ])

        groups = self.Model.read_group(
            [],
            aggregates=["value:sum"],
            groupby=["static_expand"],
        )
        self.assertEqual(groups, [
            {
                'static_expand': 'c',
                '__count': 1,
                'value:sum': 2,
                '__domain': [('static_expand', '=', 'c')],
            },
            {
                'static_expand': 'b',
                '__count': 0,
                'value:sum': 0,
                '__domain': [('static_expand', '=', 'b')],
            },
            {
                'static_expand': 'a',
                '__count': 1,
                'value:sum': 1,
                '__domain': [('static_expand', '=', 'a')],
            },
            {
                'static_expand': False,
                '__count': 1,
                'value:sum': 3,
                '__domain': [('static_expand', '=', False)],
            },
        ])

    def test_dynamic_group_expand(self):
        # this test tests the same as the above test but with a Selection field whose
        # options are dynamic, this means that the result of read_group when grouping by this
        # field can change from one call to another.
        self.Model.create([
            {"value": 1, "dynamic_expand": "a"},
            {"value": 2, "dynamic_expand": "c"},
            {"value": 3},
        ])

        groups = self.Model.read_group(
            [],
            aggregates=["value:sum"],
            groupby=["dynamic_expand"],
        )

        self.assertEqual(groups, [
            {
                'dynamic_expand': 'c',
                '__count': 1,
                'value:sum': 2,
                '__domain': [('dynamic_expand', '=', 'c')],
            },
            {
                'dynamic_expand': 'b',
                '__count': 0,
                'value:sum': 0,
                '__domain': [('dynamic_expand', '=', 'b')],
            },
            {
                'dynamic_expand': 'a',
                '__count': 1,
                'value:sum': 1,
                '__domain': [('dynamic_expand', '=', 'a')],
            },
            {
                'dynamic_expand': False,
                '__count': 1,
                'value:sum': 3,
                '__domain': [('dynamic_expand', '=', False)],
            },
        ])

    def test_no_group_expand(self):
        # if group_expand is not defined on a Selection field, it should return only the necessary
        # groups and in alphabetical order (PostgreSQL ordering)
        self.Model.create([
            {"value": 1, "no_expand": "a"},
            {"value": 2, "no_expand": "c"},
            {"value": 3},
        ])

        groups = self.Model.read_group(
            [],
            aggregates=["value:sum"],
            groupby=["no_expand"],
        )

        self.assertEqual(groups, [
            {
                'no_expand': 'a',
                '__count': 1,
                'value:sum': 1,
                '__domain': [('no_expand', '=', 'a')],
            },
            {
                'no_expand': 'c',
                '__count': 1,
                'value:sum': 2,
                '__domain': [('no_expand', '=', 'c')],
            },
            {
                'no_expand': False,
                '__count': 1,
                'value:sum': 3,
                '__domain': [('no_expand', '=', False)],
            },
        ])
