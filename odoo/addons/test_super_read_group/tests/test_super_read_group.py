# -*- coding: utf-8 -*-
"""Test for fill temporal."""

from odoo.tests import common, tagged


@tagged('super_read_group')
class TestSuperReadGroup(common.TransactionCase):
    """Test for super_read_group function.

    This feature is mainly used in graph view. For more informations, read the
    documentation of models's '_read_group_fill_temporal' method.
    """

    def setUp(self):
        super(TestSuperReadGroup, self).setUp()
        self.Model = self.env['test_super_read_group.super_model']

    def test_super_read_group_with_single_grouping_set(self):
        """should reduce to something like read_group
        """
        self.Model.create({'date': '1916-08-18', 'value': 2})
        self.Model.create({'date': '1916-10-19', 'value': 3})
        self.Model.create({'date': '1916-12-19', 'value': 5})

        records = self.Model.search([])
        record_ids = records.ids
        id_1 = record_ids[0]
        id_2 = record_ids[1]

        records[0].write({'other_id': id_1})
        records[1].write({'other_id': id_2})


        domain = []
        groups = [[],[]]
        measure_specs = ['value:sum', 'other_id:count_distinct', 'value:min']
        grouping_sets = [['date:day', 'other_id'], ['date:week', 'other_id'], [], ['other_id']]

        data_points = self.Model.super_read_group(
            domain = domain,
            groups= groups,
            measure_specs=measure_specs,
            grouping_sets=grouping_sets,
        )

        domain = []
        groups = [[],[]]
        measure_specs = []
        grouping_sets = [['date:day', 'other_id'], ['date:week', 'other_id'], [], ['other_id']]

        data_points = self.Model.super_read_group(
            domain = domain,
            groups= groups,
            measure_specs=measure_specs,
            grouping_sets=grouping_sets,
        )

        domain = []
        groups = [[]]
        measure_specs = ['value:sum', 'other_id:count_distinct', 'value:min']
        grouping_sets = [[]]

        data_points = self.Model.super_read_group(
            domain = domain,
            groups= groups,
            measure_specs=measure_specs,
            grouping_sets=grouping_sets,
        )

