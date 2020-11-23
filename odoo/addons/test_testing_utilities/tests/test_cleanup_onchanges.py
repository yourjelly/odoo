# -*- coding: utf-8 -*-
from odoo.tests.common import TransactionCase, Form
from odoo.tests.form_emulator import Form2


class TestCleanupOnchanges(TransactionCase):

    def test_editable_compute_same_value_on_dependency(self):
        ''' Ensure the custom value set on a computed editable field is not recomputed when writing the same value as
        the previous one on one of its dependency.

        Root limitation:
        Since the framework-js is not sending the minimal diff server-side when performing the onchanges, we will face
        this issue a lot of time when adding a lot of computed editable fields.
        '''
        record = self.env['onchange_cleanup_model_1'].create({'a': 42})

        self.assertRecordValues(record, [{'a': 42, 'b': 84}])

        record.b = 100

        self.assertRecordValues(record, [{'a': 42, 'b': 100}])

        record.a = 42

        # TODO FIXME: 'b' is back to 84
        self.assertRecordValues(record, [{'a': 42, 'b': 100}])

    def test_editable_compute_form_view_with_one2many_orm_check(self):
        ''' The way the computed fields are invalidated depends of the dict order passed as parameter to the 'onchange'
        method. This is causing some unexpected behavior when dealing with computed editable fields because the user
        is loosing its custom value right away during the 'onchange'.

        Explanation:
        During the 'onchange', the one2many value is cache by record._update_cache(changed_values, validate=True).
        If the field is a one2many, 'value' contains a (1, _, {...}) command for updated lines.
        Due to 'validate=True', the assignations are triggering invalidation.
        In case there is anything on the parent model editing any line value, the whole one2many values are returned to
        the user.

        see: https://github.com/odoo/odoo/pull/62060
        '''
        def assertOnchangeResult(result, expected_one2many_dict):
            self.assertTrue(result.get('value'))
            self.assertTrue(result['value'].get('line_ids'))
            self.assertEqual(len(result['value']['line_ids']), 2) # [(5,), (1, id, {...})]
            one2many_command = result['value']['line_ids'][1]
            self.assertEqual(len(one2many_command), 3)
            self.assertDictEqual(one2many_command[2], expected_one2many_dict)

        record = self.env['onchange_cleanup_model_2'].create({'line_ids': [(0, 0, {'a': 42})]})

        self.assertRecordValues(record.line_ids, [{'a': 42, 'b': 42, 'c': 0}])

        record_form = Form(record)
        fvg = record_form._view['onchange']

        # At this point, simulate an edition of b: 42 -> 12.
        expected_one2many_dict = {'a': 42, 'b': 12, 'c': 5}
        result = record.onchange({'line_ids': [(1, record.line_ids.id, {'a': 42, 'b': 12, 'c': 0})]}, 'line_ids', fvg)
        assertOnchangeResult(result, expected_one2many_dict)
        result = record.onchange({'line_ids': [(1, record.line_ids.id, {'b': 12, 'a': 42, 'c': 0})]}, 'line_ids', fvg)
        # TODO FIXME: 'b' is back to 42 due to the invalidation from 'a' because 'a' is after 'b' in the dict.
        assertOnchangeResult(result, expected_one2many_dict)

    def test_editable_compute_form_view_with_one2many_framework_check(self):
        # NOTE: this test is working fine.
        # The reason why this is problematic regarding account_move is:
        # - we need to know which fields changed in order to synchronize business/accounting fields.
        record = self.env['onchange_cleanup_model_2'].create({'line_ids': [(0, 0, {'a': 42})]})

        self.assertRecordValues(record.line_ids, [{'a': 42, 'b': 42, 'c': 0}])

        with Form(record) as record_form:
            with record_form.line_ids.edit(0) as line_form:
                line_form.b = 12

        self.assertRecordValues(record.line_ids, [{'a': 42, 'b': 12, 'c': 5}])

    def test_writing_one2many_commands_on_new_record(self):
        record = self.env['onchange_cleanup_model_2'].new({})

        # Command 0
        record.line_ids = [(0, 0, {'a': 0})]
        self.assertRecordValues(record.line_ids, [{'a': 0}])
        # Command 1
        record.line_ids = [(1, record.line_ids.id, {'a': 1})]
        self.assertRecordValues(record.line_ids, [{'a': 1}])
        # Command 2
        record.line_ids = [(2, record.line_ids.id)]
        self.assertFalse(record.line_ids)

    # def test_new_form_emulator(self):
    #     record = self.env['onchange_cleanup_model_2'].create({'line_ids': [(0, 0, {'a': 42})]})
    #     with Form2(record) as record_form:
    #         with record_form.line_ids.new() as line_form:
    #             line_form.a = 30
