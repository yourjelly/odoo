from odoo.tests.common import TransactionCase


class TestUnityWebReadGroup(TransactionCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.records = cls.env['test_new_api.multi.tag'].create([
            {'name': 'one'},
            {'name': 'two'},
            {'name': 'two'},
            {'name': 'there'},
            {'name': 'there'},
            {'name': 'there'},
        ])

    def test_web_read_group_limit_not_reached(self):
        result = self.env['test_new_api.multi.tag'].unity_web_read_group(
            [], ['__count'], ['name'], {'display_name': {}},
        )
        self.assertEqual(result, {
            'groups': [
                {
                    'name': 'one',
                    'name_count': 1,
                    '__domain': [('name', '=', 'one')],
                    '__records': [
                        {'id': self.records[0].id, 'display_name': 'one'},
                    ],
                },
                {
                    'name': 'there',
                    'name_count': 3,
                    '__domain': [('name', '=', 'there')],
                     '__records': [
                        {'id': self.records[3].id, 'display_name': 'there'},
                        {'id': self.records[4].id, 'display_name': 'there'},
                        {'id': self.records[5].id, 'display_name': 'there'},
                    ],
                },
                {
                    'name': 'two',
                    'name_count': 2,
                    '__domain': [('name', '=', 'two')],
                    '__records': [
                        {'id': self.records[1].id, 'display_name': 'two'},
                        {'id': self.records[2].id, 'display_name': 'two'},
                    ],
                },
            ],
            'length': 3,
        })

    def test_unity_web_read_group_limit_unfold(self):
        result = self.env['test_new_api.multi.tag'].unity_web_read_group(
            [], ['__count'], ['name'], {'display_name': {}}, limit_unfold=1,
        )
        self.assertEqual(result, {
            'groups': [
                {
                    'name': 'one',
                    'name_count': 1,
                    '__domain': [('name', '=', 'one')],
                    '__records': [
                        {'id': self.records[0].id, 'display_name': 'one'},
                    ],
                },
                {
                    'name': 'there',
                    'name_count': 3,
                    '__domain': [('name', '=', 'there')],
                },
                {
                    'name': 'two',
                    'name_count': 2,
                    '__domain': [('name', '=', 'two')],
                },
            ],
            'length': 3,
        })

    def test_unity_web_read_group_limit_by_group(self):
        result = self.env['test_new_api.multi.tag'].unity_web_read_group(
            [], ['__count'], ['name'], {'display_name': {}}, limit_by_group=1,
        )
        self.assertEqual(result, {
            'groups': [
                {
                    'name': 'one',
                    'name_count': 1,
                    '__domain': [('name', '=', 'one')],
                    '__records': [
                        {'id': self.records[0].id, 'display_name': 'one'},
                    ],
                },
                {
                    'name': 'there',
                    'name_count': 3,
                    '__domain': [('name', '=', 'there')],
                     '__records': [
                        {'id': self.records[3].id, 'display_name': 'there'},
                    ],
                },
                {
                    'name': 'two',
                    'name_count': 2,
                    '__domain': [('name', '=', 'two')],
                    '__records': [
                        {'id': self.records[1].id, 'display_name': 'two'},
                    ],
                },
            ],
            'length': 3,
        })
