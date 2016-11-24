# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo.conf import settings

from . import Command, OptionGroup, Option, server


# Testing group {{{
testing_group = OptionGroup("Testing Options")
testing_group.add_options([
    Option("--test-file", dest="test_file", default=False, help="Launch a python or YML test file."),

    Option("--test-report-directory", dest="test_report_directory", default=False,
           help="If set, will save sample of all reports in this directory."),

    Option("--test-commit", action="store_true", dest="test_commit", default=False,
           help="Commit database changes performed by YAML or XML tests."),
])
# }}}


class Test(Command):
    """Launch the Odoo test suite"""
    def run(self, args):
        groups = [
            testing_group,
        ]

        self.parser.usage = "%prog test [-d DATABASE] [options]"
        self.parser.add_option(server.db_option)
        self.parser.add_option_groups(groups)

        if not args:
            self.parser.exit_with_help()

        self.parser.parse_args(args)

        settings['http'] = False
        settings['test_enable'] = True
        server.bootstrap()
