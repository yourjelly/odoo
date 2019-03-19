# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import babel.dates
import datetime

from odoo import http
from odoo.http import request
from odoo.tools import date_utils
import pytz
from dateutil.relativedelta import relativedelta
from dateutil.parser import parse

# -*- coding: utf-8 -*-


class GraphModel(http.Controller):

    @http.route('/web/graph/date_interval_covering', type='json', auth="user")
    def date_interval_covering(self, start, end, interval, date_type):
        """
        Return an ordered list of date intervals that covers a given interval
        determined by left and right upper bounds.

        :param start - left bound of the interval.
        :param rigth date - right bound of the interval.
        :param interval - determines the type of covering returned,
                possible value can be 'day', 'week', 'month', 'quarter',
                or 'year'.
        :return a list of period of type 'interval' that covers the targeted
                interval.
        """
        display_formats = {
            'hour': 'hh:00 dd MMM',
            'day': 'dd MMM yyyy', # yyyy = normal year
            'week': "'W'w YYYY",  # w YYYY = ISO week-year
            'month': 'MMMM yyyy',
            'quarter': 'QQQ yyyy',
            'year': 'yyyy',
        }
        time_intervals = {
            'hour': relativedelta(hours=1),
            'day': relativedelta(days=1),
            'week': datetime.timedelta(days=7),
            'month': relativedelta(months=1),
            'quarter': relativedelta(months=3),
            'year': relativedelta(years=1)
        }
        step = time_intervals[interval]
        date_format = display_formats[interval]
        locale = request.env.context.get('lang') or 'en_US'
        tz_convert = date_type == 'datetime' and request.env.context.get('tz') in pytz.all_timezones

        def format(value):
            tzinfo = None
            # value from postgres is in local tz (so range is
            # considered in local tz e.g. "day" is [00:00, 00:00[
            # local rather than UTC which could be [11:00, 11:00]
            # local) but domain and raw value should be in UTC
            if tz_convert:
                tzinfo = value.tzinfo

            if date_type == 'datetime':
                label = babel.dates.format_datetime(
                    value, format=date_format,
                    tzinfo=tzinfo, locale=locale
                )
            else:
                label = babel.dates.format_date(
                    value, format=date_format,
                    locale=locale
                )
            return label

        start = parse(start)
        end = parse(end)
        covering_start = date_utils.start_of(start, interval)
        covering_end = date_utils.end_of(end, interval)
        covering = [
                        format(date) for date in
                        date_utils.date_range(
                            covering_start,
                            covering_end,
                            step
                        )
                    ]
        return covering