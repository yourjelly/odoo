import time

from odoo import sql_db


class TestCounters:

    def __init__(self, registry, name, logger):
        self.name = name
        self.report = registry._assertion_report
        self.logger = logger
        self.stops = []
        self.diffs = []

    def __enter__(self):
        self.logger.info("%s: start", self.name)
        self.start = self.get_counters()

    def snapshot(self):
        stop = self.get_counters()
        self.stops.append(stop)
        diff = {k: v - self.start[k] for k, v in stop.items()}
        self.diffs.append(diff)
        return diff

    def __exit__(self, type, value, traceback):
        args = {'name': self.name, **self.snapshot()}
        self.logger.info("%(name)s: %(tests)d tests in %(time).2fs, %(queries)s queries", args)

    def get_counters(self):
        return {
            'time': time.time(),
            'tests': self.report.testsRun,
            'queries': sql_db.sql_counter,
        }
