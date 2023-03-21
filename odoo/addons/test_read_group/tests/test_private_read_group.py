# -*- coding: utf-8 -*-
from odoo import fields
from odoo.tests import common
from odoo import Command


class TestPrivateReadGroup(common.TransactionCase):

    def test_simple_private_read_group(self):
        Model = self.env['test_read_group.aggregate']
        partner_1 = self.env['res.partner'].create({'name': 'z_one'})
        partner_2 = self.env['res.partner'].create({'name': 'a_two'})
        Model.create({'key': 1, 'partner_id': partner_1.id, 'value': 1})
        Model.create({'key': 1, 'partner_id': partner_1.id, 'value': 2})
        Model.create({'key': 1, 'partner_id': partner_2.id, 'value': 3})
        Model.create({'key': 2, 'partner_id': partner_2.id, 'value': 4})
        Model.create({'key': 2, 'partner_id': partner_2.id})
        Model.create({'key': 2, 'value': 5})
        Model.create({'partner_id': partner_2.id, 'value': 5})
        Model.create({'value': 6})
        Model.create({})

        with self.assertQueries([
            """
SELECT "test_read_group_aggregate"."key", SUM("test_read_group_aggregate"."value")
FROM "test_read_group_aggregate"
GROUP BY "test_read_group_aggregate"."key"
ORDER BY "test_read_group_aggregate"."key" ASC
            """,
        ]):
            self.assertEqual(
                Model._read_group([], groupby=['key'], aggregates=['value:sum']),
                [
                    (1, 1 + 2 + 3),
                    (2, 4 + 5),
                    (False, 5 + 6),
                ],
            )

        # Forcing order with many2one, traverse use the order of the comodel (res.partner)
        with self.assertQueries([
            """
SELECT "test_read_group_aggregate"."key", "test_read_group_aggregate"."partner_id", SUM("test_read_group_aggregate"."value")
FROM "test_read_group_aggregate"
    LEFT JOIN "res_partner" AS "test_read_group_aggregate__partner_id" ON ("test_read_group_aggregate"."partner_id" = "test_read_group_aggregate__partner_id"."id")
GROUP BY "test_read_group_aggregate"."key", "test_read_group_aggregate"."partner_id", "test_read_group_aggregate__partner_id"."display_name", "test_read_group_aggregate__partner_id"."id"
ORDER BY "test_read_group_aggregate"."key" ASC, "test_read_group_aggregate__partner_id"."display_name", "test_read_group_aggregate__partner_id"."id"
            """,
        ]):
            self.assertEqual(
                Model._read_group([], groupby=['key', 'partner_id'], aggregates=['value:sum'], order="key, partner_id"),
                [
                    (1, partner_2, 3),
                    (1, partner_1, 1 + 2),
                    (2, partner_2, 4),
                    (2, self.env['res.partner'], 5),
                    (False, partner_2, 5),
                    (False, self.env['res.partner'], 6),
                ],
            )

        # Same than before but with private method, the order doesn't traverse many2one order, then the order is based on id of partner
        with self.assertQueries([
            """
SELECT "test_read_group_aggregate"."key", "test_read_group_aggregate"."partner_id", SUM("test_read_group_aggregate"."value")
FROM "test_read_group_aggregate"
GROUP BY "test_read_group_aggregate"."key", "test_read_group_aggregate"."partner_id"
ORDER BY "test_read_group_aggregate"."key" ASC, "test_read_group_aggregate"."partner_id" ASC
            """,
        ]):
            self.assertEqual(
                Model._read_group([], groupby=['key', 'partner_id'], aggregates=['value:sum']),
                [
                    (1, partner_1, 1 + 2),
                    (1, partner_2, 3),
                    (2, partner_2, 4),
                    (2, self.env['res.partner'], 5),
                    (False, partner_2, 5),
                    (False, self.env['res.partner'], 6),
                ],
            )

    def test_falsy_domain(self):
        Model = self.env['test_read_group.aggregate']

        with self.assertQueryCount(0):
            Model._read_group([('id', 'in', [])], ['partner_id'], [])

        with self.assertQueryCount(0):
            res = Model._read_group([('id', 'in', [])], [], ['__count', 'partner_id:count', 'partner_id:count_distinct'])
            # When there are no group, postgresql return always one row,
            # check that it is the case when the domain is falsy and the query is not made at all
            self.assertEqual(res[0], (0, 0, 0))

    def test_prefetch_for_records(self):
        Model = self.env['test_read_group.aggregate']
        Partner = self.env['res.partner']
        partner_1 = Partner.create({'name': 'z_one'})
        partner_2 = Partner.create({'name': 'a_two'})
        Model.create({'key': 1, 'partner_id': partner_1.id})
        Model.create({'key': 2, 'partner_id': partner_2.id})

        Partner.invalidate_model()

        res = Model._read_group([], ['partner_id'], [])

        [[partner_1], [partner_2]] = res
        partner_1.name
        with self.assertQueryCount(0):
            # Already prefetch with partner_1.name
            partner_2.name

    def test_ambiguous_field_name(self):
        """ Check that _read_group doesn't generate ambiguous (display_name) alias for PostgreSQL
        """
        Model = self.env['test_read_group.aggregate']
        partner_1 = self.env['res.partner'].create({'name': 'z_one'})
        Model.create({'key': 1, 'partner_id': partner_1.id, 'value': 1, 'display_name': 'blabla'})
        with self.assertQueries([
            """
SELECT "test_read_group_aggregate"."display_name", "test_read_group_aggregate"."partner_id", COUNT(*)
FROM "test_read_group_aggregate"
    LEFT JOIN "res_partner" AS "test_read_group_aggregate__partner_id" ON ("test_read_group_aggregate"."partner_id" = "test_read_group_aggregate__partner_id"."id")
GROUP BY "test_read_group_aggregate"."display_name", "test_read_group_aggregate"."partner_id", "test_read_group_aggregate__partner_id"."display_name", "test_read_group_aggregate__partner_id"."id"
ORDER BY "test_read_group_aggregate__partner_id"."display_name" DESC, "test_read_group_aggregate__partner_id"."id" DESC
            """,
        ]):
            self.assertEqual(
                Model._read_group([], ['display_name', 'partner_id'], ['__count'], order="partner_id DESC"),
                [('blabla', partner_1, 1)],
            )

    def test_bool_read_groups(self):
        Model = self.env['test_read_group.aggregate.boolean']
        Model.create({'key': 1, 'bool_and': True})
        Model.create({'key': 1, 'bool_and': True})

        Model.create({'key': 2, 'bool_and': True})
        Model.create({'key': 2, 'bool_and': False})

        Model.create({'key': 3, 'bool_and': False})
        Model.create({'key': 3, 'bool_and': False})

        Model.create({'key': 4, 'bool_and': True, 'bool_or': True, 'bool_array': True})
        Model.create({'key': 4})

        self.assertEqual(
            Model._read_group([], groupby=['key'], aggregates=['bool_and:bool_and', 'bool_and:bool_or', 'bool_and:array_agg_distinct']),
            [
                (1, True, True, [True]),
                (2, False, True, [False, True]),
                (3, False, False, [False]),
                (4, False, True, [False, True]),
            ],
        )

    def test_count_read_groups(self):
        Model = self.env['test_read_group.aggregate']
        Model.create({'key': 1})
        Model.create({'key': 1})
        Model.create({})

        self.assertEqual(
            Model._read_group([], aggregates=['key:count']),
            [(2,)],
        )

        self.assertEqual(
            Model._read_group([], aggregates=['key:count_distinct']),
            [(1,)],
        )

    def test_array_read_groups(self):
        Model = self.env['test_read_group.aggregate']
        Model.create({'key': 1})
        Model.create({'key': 1})
        Model.create({'key': 2})

        self.assertEqual(
            Model._read_group([], aggregates=['key:array_agg']),
            [([1, 1, 2],)],
        )

        self.assertEqual(
            Model._read_group([], aggregates=['key:array_agg_distinct']),
            [([1, 2],)],
        )

    def test_flush_read_group(self):
        Model = self.env['test_read_group.aggregate']
        a = Model.create({'key': 1, 'value': 5})
        b = Model.create({'key': 1, 'value': 5})

        self.assertEqual(
            Model._read_group([], groupby=['key'], aggregates=['value:sum']),
            [(1, 5 + 5)],
        )

        # Test flush of domain
        a.key = 2
        self.assertEqual(
            Model._read_group([('key', '>', 1)], groupby=['key'], aggregates=['value:sum']),
            [
                (2, 5),
            ],
        )

        # test flush of groupby clause
        a.key = 3
        self.assertEqual(
            Model._read_group([], groupby=['key'], aggregates=['value:sum']),
            [
                (1, 5),
                (3, 5),
            ],
        )

        # Test flush of _read_groups
        b.value = 8
        self.assertEqual(
            Model._read_group([], groupby=['key'], aggregates=['value:sum']),
            [
                (1, 8),
                (3, 5),
            ],
        )

    def test_having_clause(self):
        Model = self.env['test_read_group.aggregate']
        Model.create({'key': 1, 'value': 8})
        Model.create({'key': 1, 'value': 2})

        Model.create({'key': 2, 'value': 5})

        Model.create({'key': 3, 'value': 2})
        Model.create({'key': 3, 'value': 4})
        Model.create({'key': 3, 'value': 1})
        with self.assertQueries([
            """
SELECT "test_read_group_aggregate"."key", SUM("test_read_group_aggregate"."value")
FROM "test_read_group_aggregate"
GROUP BY "test_read_group_aggregate"."key"
HAVING SUM("test_read_group_aggregate"."value") > %s
ORDER BY "test_read_group_aggregate"."key" ASC
            """,
        ]):
            self.assertEqual(
                Model._read_group([], groupby=['key'], aggregates=['value:sum'], having=[("value:sum", '>', 8)]),
                [(1, 2 + 8)],
            )

        with self.assertQueries([
            """
SELECT "test_read_group_aggregate"."key", SUM("test_read_group_aggregate"."value"), COUNT(*)
FROM "test_read_group_aggregate"
GROUP BY "test_read_group_aggregate"."key"
HAVING (COUNT(*) < %s AND SUM("test_read_group_aggregate"."value") > %s)
ORDER BY "test_read_group_aggregate"."key" ASC
            """,
        ]):
            self.assertEqual(
                Model._read_group(
                    [],
                    groupby=['key'],
                    aggregates=['value:sum', '__count'],
                    having=[
                        ('__count', '<', 3),
                        ("value:sum", '>', 4),
                    ],
                ),
                [
                    (1, 2 + 8, 2),
                    (2, 5, 1),
                ],
            )

    def test_malformed_params(self):
        Model = self.env['test_read_group.fill_temporal']
        # Test malformed groupby clause
        with self.assertRaises(ValueError):
            Model._read_group([], ['date:bad_granularity'])

        with self.assertRaises(ValueError):
            Model._read_group([], ['Other stuff date:week'])

        with self.assertRaises(ValueError):
            Model._read_group([], ['date'])  # No granularity

        with self.assertRaises(ValueError):
            Model._read_group([], ['"date:week'])

        # Test malformed aggregate clause
        with self.assertRaises(ValueError):
            Model._read_group([], aggregates=['value'])  # No aggregate

        with self.assertRaises(ValueError):
            Model._read_group([], aggregates=['__count_'])

        with self.assertRaises(ValueError):
            Model._read_group([], aggregates=['value:__count'])

        with self.assertRaises(ValueError):
            Model._read_group([], aggregates=['other value:sum'])

        with self.assertRaises(ValueError):
            Model._read_group([], aggregates=['"value:sum'])

        # Test malformed having clause
        with self.assertRaises(ValueError):
            Model._read_group([], ['value'], having=[('__count', '>')])

        with self.assertRaises(ValueError):
            Model._read_group([], ['value'], having=["COUNT(*) > 2"])

        with self.assertRaises(ValueError):
            Model._read_group([], ['value'], having=[('"="')])

        # Test malformed order clause
        with self.assertRaises(ValueError):
            Model._read_group([], ['value'], order='__count DESC other')

        with self.assertRaises(ValueError):
            Model._read_group([], ['value'], order='value" DESC')

        with self.assertRaises(ValueError):
            Model._read_group([], ['value'], order='value ASCCC')

    def test_groupby_date(self):
        """ Test what happens when grouping on date fields """
        Model = self.env['test_read_group.fill_temporal'].with_context()
        Model.create({})  # Falsy date
        Model.create({'date': '2022-01-29'})  # Saturday (week of '2022-01-24')
        Model.create({'date': '2022-01-29'})  # Same day
        Model.create({'date': '2022-01-30'})  # Sunday
        Model.create({'date': '2022-01-31'})  # Monday (other week)
        Model.create({'date': '2022-02-01'})  # (other month)
        Model.create({'date': '2022-05-29'})  # other quarter
        Model.create({'date': '2023-01-29'})  # other year

        gb = Model._read_group([], ['date:day'], ['__count'])

        self.assertEqual(gb, [
            (fields.Date.to_date('2022-01-29'), 2),
            (fields.Date.to_date('2022-01-30'), 1),
            (fields.Date.to_date('2022-01-31'), 1),
            (fields.Date.to_date('2022-02-01'), 1),
            (fields.Date.to_date('2022-05-29'), 1),
            (fields.Date.to_date('2023-01-29'), 1),
            (False, 1),
        ])

        gb = Model._read_group([], ['date:week'], ['__count'])

        self.assertEqual(gb, [
            (fields.Date.to_date('2022-01-23'), 2),
            (fields.Date.to_date('2022-01-30'), 3),
            (fields.Date.to_date('2022-05-29'), 1),
            (fields.Date.to_date('2023-01-29'), 1),
            (False, 1),
        ])

        gb = Model._read_group([], ['date:month'], ['__count'])
        self.assertEqual(gb, [
            (fields.Date.to_date('2022-01-01'), 4),
            (fields.Date.to_date('2022-02-01'), 1),
            (fields.Date.to_date('2022-05-01'), 1),
            (fields.Date.to_date('2023-01-01'), 1),
            (False, 1),
        ])

        gb = Model._read_group([], ['date:quarter'], ['__count'])
        self.assertEqual(gb, [
            (fields.Date.to_date('2022-01-01'), 5),
            (fields.Date.to_date('2022-04-01'), 1),
            (fields.Date.to_date('2023-01-01'), 1),
            (False, 1),
        ])

        gb = Model._read_group([], ['date:year'], ['__count'])
        self.assertEqual(gb, [
            (fields.Date.to_date('2022-01-01'), 6),
            (fields.Date.to_date('2023-01-01'), 1),
            (False, 1),
        ])
        # Reverse order
        gb = Model._read_group([], ['date:year'], ['__count'], order="date:year DESC")
        self.assertEqual(gb, [
            (False, 1),
            (fields.Date.to_date('2023-01-01'), 1),
            (fields.Date.to_date('2022-01-01'), 6),
        ])

    def test_groupby_datetime(self):
        Model = self.env['test_read_group.fill_temporal']
        create_values = [
            {'datetime': False, 'value': 13},
            {'datetime': '1916-08-18 01:50:00', 'value': 3},
            {'datetime': '1916-08-19 01:30:00', 'value': 7},
            {'datetime': '1916-10-18 02:30:00', 'value': 5},
        ]
        # Time Zone                      UTC     UTC DST
        tzs = ["America/Anchorage",  # -09:00    -08:00
               "Europe/Brussels",    # +01:00    +02:00
               "Pacific/Kwajalein"]  # +12:00    +12:00
        for tz in tzs:
            Model = Model.with_context(tz=tz)
            records = Model.create(create_values)

            self.assertEqual(
                Model._read_group([('id', 'in', records.ids)], ['datetime:hour'], ['value:sum']),
                [
                    (
                        fields.Datetime.context_timestamp(
                            Model, fields.Datetime.to_datetime('1916-08-18 01:00:00'),
                        ),
                        3,
                    ),
                    (
                        fields.Datetime.context_timestamp(
                            Model, fields.Datetime.to_datetime('1916-08-19 01:00:00'),
                        ),
                        7,
                    ),
                    (
                        fields.Datetime.context_timestamp(
                            Model, fields.Datetime.to_datetime('1916-10-18 02:00:00'),
                        ),
                        5,
                    ),
                    (
                        False,
                        13,
                    ),
                ],
            )

    def test_auto_join(self):
        """ Test what happens when grouping with a domain using a one2many field with auto_join. """
        model = self.env['test_read_group.order']
        records = model.create([{
            'line_ids': [Command.create({'value': 1}), Command.create({'value': 2})],
        }, {
            'line_ids': [Command.create({'value': 1})],
        }])

        domain1 = [('id', 'in', records.ids), ('line_ids.value', '=', 1)]
        domain2 = [('id', 'in', records.ids), ('line_ids.value', '>', 0)]

        # reference results
        self.assertEqual(len(model.search(domain1)), 2)
        self.assertEqual(len(model.search(domain2)), 2)

        result1 = model._read_group(domain1, aggregates=['__count'])
        self.assertEqual(len(result1), 1)
        self.assertEqual(result1[0][0], 2)

        result2 = model._read_group(domain2, aggregates=['__count'])
        self.assertEqual(len(result2), 1)
        self.assertEqual(result2[0][0], 2)

        # same requests, with auto_join
        self.patch(type(model).line_ids, 'auto_join', True)

        self.assertEqual(len(model.search(domain1)), 2)
        self.assertEqual(len(model.search(domain2)), 2)

        result1 = model._read_group(domain1, aggregates=['__count'])
        self.assertEqual(len(result1), 1)
        self.assertEqual(result1[0][0], 2)

        result2 = model._read_group(domain2, aggregates=['__count'])
        self.assertEqual(len(result2), 1)
        self.assertEqual(result2[0][0], 2)

    def test_many2many_groupby(self):
        users = self.env['test_read_group.user'].create([
            {'name': 'Mario'},
            {'name': 'Luigi'},
        ])
        tasks = self.env['test_read_group.task'].create([
            {   # both users
                'name': "Super Mario Bros.",
                'user_ids': [Command.set(users.ids)],
            },
            {   # mario only
                'name': "Paper Mario",
                'user_ids': [Command.set(users[0].ids)],
            },
            {   # luigi only
                'name': "Luigi's Mansion",
                'user_ids': [Command.set(users[1].ids)],
            },
            {   # no user
                'name': 'Donkey Kong',
            },
        ])

        # TODO: should we order by the relation and not by the id also for many2many (same than many2one) ? for public methods ?
        self.assertEqual(tasks._read_group(
                [('id', 'in', tasks.ids)],
                ['user_ids'],
                ['name:array_agg'],
            ),
            [
                (   # tasks of Mario
                    users[0],
                    ["Super Mario Bros.", "Paper Mario"],
                ),
                (   # tasks of Luigi
                    users[1],
                    ["Super Mario Bros.", "Luigi's Mansion"],
                ),
                (   # tasks of nobody
                    users.browse(),
                    ["Donkey Kong"],
                ),
            ],
        )
