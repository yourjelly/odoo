from dateutil.relativedelta import relativedelta

from odoo.tests.common import TransactionCase
from odoo import Command, fields


class TestUnifiedRead(TransactionCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()

        cls.author = cls.env['test_new_api.person'].create({'name': 'ged'})
        cls.teacher = cls.env['test_new_api.person'].create({'name': 'aab'})
        cls.course = cls.env['test_new_api.course'].create({
            'name': 'introduction to OWL',
            'author_id': cls.author.id
        })
        cls.lesson_day1 = cls.env['test_new_api.lesson'].create({
            'name': 'first day',
            'date': fields.Date.today(),
            'course_id': cls.course.id,
            'teacher_id': cls.teacher.id,
            'attendee_ids': [Command.create({'name': '123'}),
                             Command.create({'name': '456'}),
                             Command.create({'name': '789'})]
        })
        cls.lesson_day2 = cls.env['test_new_api.lesson'].create({
            'name': 'second day',
            'date': fields.Date.today() + relativedelta(days=1),
            'course_id': cls.course.id,
            'teacher_id': cls.teacher.id
        })

    def test_read_add_id(self):
        read = self.course.read({'name': {}})
        self.assertEqual(read, [{'id': self.course.id, 'name': 'introduction to OWL'}])

    def test_read_many2one_gives_id_name(self):
        read = self.course.read({'name': {}, 'author_id': {}})
        self.assertEqual(read, [
            {'id': self.course.id,
             'name': 'introduction to OWL',
             'author_id': (self.author.id, 'ged')}])

    def test_many2one_respects_context(self):
        read = self.course.read(

            {
                'name': {},
                'author_id':
                    {
                        'context': {'special': 'absolutely'}
                    }
            })
        self.assertEqual(read, [

            {
                'id': self.course.id,
                'name': 'introduction to OWL',
                'author_id': (self.author.id, 'ged special')
            }])

    def test_read_one2many_gives_ids(self):
        read = self.course.read({'name': {}, 'lesson_ids': {}})
        self.assertEqual(read, [
            {
                'id': self.course.id,
                'name': 'introduction to OWL',
                'lesson_ids': [self.lesson_day1.id, self.lesson_day2.id]}])

    def test_specify_fields_one2many(self):
        read = self.course.read(
            {
                'name': {},
                'lesson_ids':
                    {
                        'fields': {'name': {}}
                    }
            })

        self.assertEqual(read, [
            {
                'id': self.course.id,
                'name': 'introduction to OWL',
                'lesson_ids': {
                    'ids': (self.lesson_day1.id, self.lesson_day2.id),
                    'values': [
                        {'id': self.lesson_day1.id, 'name': 'first day'},
                        {'id': self.lesson_day2.id, 'name': 'second day'}
                    ],
                }
            }])

    def test_one2many_context_have_no_impact_on_name(self):
        read = self.course._read_main(
            {
                'name': {},
                'lesson_ids':
                    {
                        'fields': {'name': {}},
                        'context': {'special': 'absolutely'}
                    }
            })

        self.assertEqual(read, [
            {
                'id': self.course.id,
                'name': 'introduction to OWL',
                'lesson_ids': {
                    'ids': (self.lesson_day1.id, self.lesson_day2.id),
                    'values': [
                        {'id': self.lesson_day1.id, 'name': 'first day'},
                        {'id': self.lesson_day2.id, 'name': 'second day'}
                    ],
                }
            }])

    def test_one2many_respects_context(self):
        read = self.course._read_main(
            {
                'name': {},
                'lesson_ids':
                    {
                        'fields': {'display_name': {}},
                        'context': {'special': 'absolutely'}
                    }
            })

        self.assertEqual(read, [
            {
                'id': self.course.id,
                'name': 'introduction to OWL',
                'lesson_ids': {
                    'ids': (self.lesson_day1.id, self.lesson_day2.id),
                    'values': [
                        {'id': self.lesson_day1.id, 'display_name': 'special first day'},
                        {'id': self.lesson_day2.id, 'display_name': 'special second day'}
                    ],
                }
            }])

    def test_read_many2many_gives_ids(self):
        read = self.course.read({'name': {},
                                 'lesson_ids': {
                                     'fields': {
                                         'attendee_ids': {}
                                     }
                                 }})
        self.assertEqual(read, [
            {
                'id': self.course.id,
                'name': 'introduction to OWL',
                'lesson_ids': {
                    'ids': (self.lesson_day1.id, self.lesson_day2.id),
                    'values': [  # TODO VSC: should we also give {ids: [], values:[]} ?
                        {'id': self.lesson_day1.id, 'attendee_ids': [*self.lesson_day1.attendee_ids._ids]},
                        {'id': self.lesson_day2.id, 'attendee_ids': []}
                    ],
                }
            }])

    def test_specify_fields_many2many(self):
        read = self.course.read({'name': {},
                                 'lesson_ids': {
                                     'fields': {
                                         'attendee_ids': {
                                             'fields': {
                                                 'name': {}
                                             }
                                         }
                                     }
                                 }})

        self.assertEqual(read, [
            {
                'id': self.course.id,
                'name': 'introduction to OWL',
                'lesson_ids':
                    {
                        'ids': (self.lesson_day1.id, self.lesson_day2.id),
                        'values':
                            [
                                {
                                    'id': self.lesson_day1.id,
                                    'attendee_ids': {
                                        'ids': self.lesson_day1.attendee_ids._ids,
                                        'values': [
                                            {'id': self.lesson_day1.attendee_ids._ids[0], 'name': '123'},
                                            {'id': self.lesson_day1.attendee_ids._ids[1], 'name': '456'},
                                            {'id': self.lesson_day1.attendee_ids._ids[2], 'name': '789'}
                                        ],
                                    }
                                },
                                {'id': self.lesson_day2.id, 'attendee_ids': {'ids': (), 'values': []}}
                            ]
                    }
            }])

#
# def test_many2many_respects_limit(self):
#     pass
#
# def test_many2many_respects_count_limit(self):
#     pass
#
# def test_many2many_respects_offset(self):
#     pass

# def test_many2many_respects_order(self):
#     pass
