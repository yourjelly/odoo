# -*- coding: utf-8 -*-
from odoo.addons.account.tests.common import AccountTestInvoicingCommon
from odoo.tests.common import Form
from odoo.tests import tagged
from odoo.exceptions import ValidationError

from functools import reduce
import json


@tagged('post_install', '-at_install')
class TestAccountMoveJournalSequencing(AccountTestInvoicingCommon):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()

        cls.account_id = cls.company_data['default_account_revenue'].id

        cls.journal_1 = cls.company_data['default_journal_misc'].copy()
        cls.journal_1.code = 'MISC1'
        cls.journal_2 = cls.journal_1.copy()
        cls.journal_2.code = 'MISC2'

    def test_journal_sequence(self):
        move_1 = self.env['account.move'].create({
            'date': '2016-01-01',
            'journal_id': self.journal_1.id,
            'line_ids': [
                (0, 0, {'name': '/', 'account_id': self.account_id, 'debit': 1}),
                (0, 0, {'name': '/', 'account_id': self.account_id, 'credit': 1}),
            ],
        })

        self.assertEqual(move_1.name, 'MISC1/2016/01/0001')
        move_1.post()
        self.assertEqual(move_1.name, 'MISC1/2016/01/0001')

        move_2 = move_1.copy()
        self.assertEqual(move_2.name, '/')
        move_2.post()
        self.assertEqual(move_2.name, 'MISC1/2016/01/0002')

        move_3 = move_1.copy()
        move_3.journal_id = self.journal_2
        self.assertEqual(move_3.name, 'MISC2/2016/01/0001')
        with Form(move_3) as move_form:  # It is editable in the form
            move_form.name = 'MyMISC/2099/0001'
        move_3.post()
        self.assertEqual(move_3.name, 'MyMISC/2099/0001')

        move_4 = move_3.copy()
        self.assertEqual(move_4.name, '/')
        with self.assertRaises(AssertionError):
            with Form(move_3) as move_form:  # It is not editable in the form
                move_form.name = 'MyMISC/2099/0002'
        move_4.post()
        self.assertEqual(move_4.name, 'MyMISC/2099/0002')
        move_4.name = 'MISC2/2016/00002'

        move_5 = move_3.copy()
        move_5.post()
        self.assertEqual(move_5.name, 'MyMISC/2099/0002')

        move_6 = move_3.copy()
        move_6.date = '2021-02-02'
        move_6.post()
        self.assertEqual(move_6.name, 'MyMISC/2021/0001')
        move_6.name = 'N\'importe quoi?'

        move_7 = move_6.copy()
        move_7.post()
        self.assertEqual(move_7.name, '1N\'importe quoi?')

    def _test_journal_sequence_periods(self, sequence_init, sequence_next, sequence_next_month, sequence_next_year):
        """Test different format of sequences and what it becomes on another period"""
        moves = self.env['account.move'].create([{
            'date': date,
            'journal_id': self.journal_1.id,
            'line_ids': [
                (0, 0, {'name': '/', 'account_id': self.account_id, 'debit': 1}),
                (0, 0, {'name': '/', 'account_id': self.account_id, 'credit': 1}),
            ],
        } for date in ('2016-03-12', '2016-03-12', '2016-04-12', '2017-03-12')])
        moves.post()

        moves[0].name = sequence_init
        moves[1:].name = False
        moves[1:]._compute_name()
        for move, expected_name in zip(moves, [sequence_init, sequence_next, sequence_next_month, sequence_next_year]):
            self.assertEqual(move.name, expected_name)

    def test_journal_sequence_periods_1(self):
        self._test_journal_sequence_periods('JRNL/2016/00001', 'JRNL/2016/00002', 'JRNL/2016/00003', 'JRNL/2017/00001')

    def test_journal_sequence_periods_2(self):
        self._test_journal_sequence_periods('1234567', '1234568', '1234569', '1234570')

    def test_journal_sequence_periods_3(self):
        self._test_journal_sequence_periods('20190910', '20190911', '20190912', '20190913')

    def test_journal_sequence_periods_4(self):
        self._test_journal_sequence_periods('2019-0910', '2019-0911', '2019-0912', '2017-0001')

    def test_journal_sequence_periods_5(self):
        self._test_journal_sequence_periods('201909-10', '201909-11', '201604-01', '201703-01')

    def test_journal_sequence_periods_6(self):
        self._test_journal_sequence_periods('JRNL/2016/00001suffix', 'JRNL/2016/00002suffix', 'JRNL/2016/00003suffix', 'JRNL/2017/00001suffix')

    def test_journal_override_sequence_regex(self):
        move_1 = self.env['account.move'].create({
            'date': '2016-01-01',
            'journal_id': self.journal_1.id,
            'line_ids': [
                (0, 0, {'name': '/', 'account_id': self.account_id, 'debit': 1}),
                (0, 0, {'name': '/', 'account_id': self.account_id, 'credit': 1}),
            ],
        })
        move_1.name = '00000876-G 0002'
        move_2 = move_1.copy()
        move_2.post()
        self.assertEqual(move_2.name, '00000876-G 0003')

        move_2.journal_id.sequence_override_regex = r'^(?P<prefix1>)(?P<seq>\d*)(?P<suffix>.*)$'
        move_2.name = '/'
        move_2._compute_name()
        self.assertEqual(move_2.name, '00000877-G 0002')

    def test_journal_sequence_ordering(self):
        move_2016 = self.env['account.move'].create({
            'date': '2016-01-01',
            'journal_id': self.journal_1.id,
            'line_ids': [
                (0, 0, {'name': '/', 'account_id': self.account_id, 'debit': 1}),
                (0, 0, {'name': '/', 'account_id': self.account_id, 'credit': 1}),
            ],
        })
        move_2016.name = 'XMISC/2016/00001'

        moves_2019 = self.env['account.move'].create([{
            'date': date,
            'journal_id': self.journal_1.id,
            'line_ids': [
                (0, 0, {'name': '/', 'account_id': self.account_id, 'debit': 1}),
                (0, 0, {'name': '/', 'account_id': self.account_id, 'credit': 1}),
            ],
        } for date in ('2019-03-05', '2019-03-06', '2019-03-07', '2019-03-04', '2019-03-05', '2019-03-05')])
        moves_2019.post()

        # Ordered by date
        self.assertRecordValues(moves_2019, [
            {'name': 'XMISC/2019/00002'},
            {'name': 'XMISC/2019/00005'},
            {'name': 'XMISC/2019/00006'},
            {'name': 'XMISC/2019/00001'},
            {'name': 'XMISC/2019/00003'},
            {'name': 'XMISC/2019/00004'},
        ])

        # Can't have twice the same name
        with self.assertRaises(ValidationError):
            moves_2019[0].name = 'XMISC/2019/00001'

        # Lets remove the order by date
        moves_2019[0].name = 'XMISC/2019/10001'
        moves_2019[1].name = 'XMISC/2019/10002'
        moves_2019[2].name = 'XMISC/2019/10003'
        moves_2019[3].name = 'XMISC/2019/10004'
        moves_2019[4].name = 'XMISC/2019/10005'
        moves_2019[5].name = 'XMISC/2019/10006'

        moves_2019[4].with_context(force_delete=True).unlink()
        moves_2019[5].button_draft()

        wizard = Form(self.env['account.resequence.wizard'].with_context(active_ids=set(moves_2019.ids) - set(moves_2019[4].ids), active_model='account.move'))

        new_values = json.loads(wizard.new_values)
        self.assertEqual(new_values[str(moves_2019[0].id)]['new_by_date'], 'XMISC/2019/10002')
        self.assertEqual(new_values[str(moves_2019[0].id)]['new_by_name'], 'XMISC/2019/10001')

        self.assertEqual(new_values[str(moves_2019[1].id)]['new_by_date'], 'XMISC/2019/10004')
        self.assertEqual(new_values[str(moves_2019[1].id)]['new_by_name'], 'XMISC/2019/10002')

        self.assertEqual(new_values[str(moves_2019[2].id)]['new_by_date'], 'XMISC/2019/10005')
        self.assertEqual(new_values[str(moves_2019[2].id)]['new_by_name'], 'XMISC/2019/10003')

        self.assertEqual(new_values[str(moves_2019[3].id)]['new_by_date'], 'XMISC/2019/10001')
        self.assertEqual(new_values[str(moves_2019[3].id)]['new_by_name'], 'XMISC/2019/10004')

        self.assertEqual(new_values[str(moves_2019[5].id)]['new_by_date'], 'XMISC/2019/10003')
        self.assertEqual(new_values[str(moves_2019[5].id)]['new_by_name'], 'XMISC/2019/10005')

        wizard.save().resequence()

        self.assertEqual(moves_2019[3].state, 'posted')
        self.assertEqual(moves_2019[5].name, 'XMISC/2019/10005')
        self.assertEqual(moves_2019[5].state, 'draft')
