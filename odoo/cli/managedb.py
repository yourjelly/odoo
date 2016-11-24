# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import os

from odoo.conf import settings

from . import Command, OptionGroup, Option, server


def sanitize_dict(value):
    if value:
        return dict.fromkeys(value.split(','), 1)
    return {}


# DB Manager {{{
managedb_group = OptionGroup("DB Manager options")
managedb_group.add_options([
    Option("-i", "--init", dest="init", save=False, sanitize=sanitize_dict,
           help="install one or more modules (comma-separated list, use \"all\" for all modules), requires -d"),

    Option("-u", "--update", dest="update", save=False, sanitize=sanitize_dict,
           help="update one or more modules (comma-separated list, use \"all\" for all modules). Requires -d."),

    Option("--without-demo", dest="without_demo", default=False,
           help="disable loading demo data for modules to be installed (comma-separated, use \"all\" for all modules). "
                "Requires -d and -i. Default is %default"),

    Option("-P", "--import-partial", dest="import_partial", default='',
           help="Use this for big data importation, if it crashes you will be able to continue at the current state. "
                "Provide a filename to store intermediate importation states."),
])
# # }}}


class ManageDB(Command):
    """Manage Odoo databases"""
    def run(self, args):
        groups = [
            managedb_group,
            server.shared_group,
        ]

        self.parser.usage = "%prog managedb [-d DATABASE] [options]"
        self.parser.add_option(server.db_option)
        self.parser.add_option_groups(groups)

        if not args:
            self.parser.exit_with_help()

        self.parser.parse_args(args)

        settings['http'] = False
        server.bootstrap()
