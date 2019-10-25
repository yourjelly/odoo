# -*- coding: utf-8 -*-

from datetime import timedelta

from odoo.addons.event.models.event import EventEvent
from odoo.addons.event.tests.common import TestEventCommon


class TestEventTimedeltaConverter(TestEventCommon):
    def test_timedelta_convertion(self):
        delta = timedelta(weeks=260, hours=2)
        excepted = '4 years'
        self.assertEqual(EventEvent._timedelta_2_biggest_uom_str(delta), excepted)

        delta = timedelta(weeks=60, hours=2)
        excepted = '1 year'
        self.assertEqual(EventEvent._timedelta_2_biggest_uom_str(delta), excepted)

        delta = timedelta(weeks=10, hours=2)
        excepted = '2 months'
        self.assertEqual(EventEvent._timedelta_2_biggest_uom_str(delta), excepted)

        delta = timedelta(weeks=5, hours=2)
        excepted = '1 month'
        self.assertEqual(EventEvent._timedelta_2_biggest_uom_str(delta), excepted)

        delta = timedelta(weeks=3, hours=2)
        excepted = '3 weeks'
        self.assertEqual(EventEvent._timedelta_2_biggest_uom_str(delta), excepted)

        delta = timedelta(weeks=1, hours=2)
        excepted = '1 week'
        self.assertEqual(EventEvent._timedelta_2_biggest_uom_str(delta), excepted)

        delta = timedelta(days=3, hours=2)
        excepted = '3 days'
        self.assertEqual(EventEvent._timedelta_2_biggest_uom_str(delta), excepted)

        delta = timedelta(days=1, hours=2)
        excepted = '1 day'
        self.assertEqual(EventEvent._timedelta_2_biggest_uom_str(delta), excepted)

        delta = timedelta(hours=2, seconds=155)
        excepted = '2 hours'
        self.assertEqual(EventEvent._timedelta_2_biggest_uom_str(delta), excepted)

        delta = timedelta(hours=1, seconds=155)
        excepted = '1 hour'
        self.assertEqual(EventEvent._timedelta_2_biggest_uom_str(delta), excepted)

        delta = timedelta(minutes=2, seconds=55)
        excepted = '2 minutes'
        self.assertEqual(EventEvent._timedelta_2_biggest_uom_str(delta), excepted)

        delta = timedelta(minutes=1, seconds=55)
        excepted = '1 minute'
        self.assertEqual(EventEvent._timedelta_2_biggest_uom_str(delta), excepted)

        delta = timedelta(seconds=55)
        excepted = '55 seconds'
        self.assertEqual(EventEvent._timedelta_2_biggest_uom_str(delta), excepted)

        delta = timedelta(seconds=1)
        excepted = '1 second'
        self.assertEqual(EventEvent._timedelta_2_biggest_uom_str(delta), excepted)
