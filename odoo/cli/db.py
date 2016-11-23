# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from __future__ import absolute_import, division, print_function

import argparse
from collections import OrderedDict
import inspect
import os
import sys
import textwrap

from . import Command


class DB(Command):
    """
    Manage Odoo databases
    """
    def run(self, cmdargs):
        doclines = self.__doc__.strip().splitlines()
        self.parser = parser = argparse.ArgumentParser(
            prog="%s db" % sys.argv[0].split(os.path.sep)[-1],
            description=doclines[0],
            epilog=textwrap.dedent('\n'.join(doclines[1:])),
            formatter_class=argparse.RawTextHelpFormatter,
            add_help=False,
        )

        parser.add_argument("-c", "--config", dest="config", help="Specify an alternate config file"),
        subparsers = parser.add_subparsers()

        commands = OrderedDict()
        for name, method in inspect.getmembers(self, inspect.ismethod):
            if name.startswith('cmd_'):
                commands[name[4:]] = method

        for name, method in commands.items():
            sub = subparsers.add_parser(name, help=method.__doc__.strip())
            sub.set_defaults(command=name)

        if not cmdargs:
            sys.exit(parser.print_help())

        args, server_args = parser.parse_known_args(args=cmdargs)
        commands[args.command](server_args)

    def cmd_init(self, args):
        """Initialize database"""

    def cmd_install(self, args):
        """Install one or more modules to a database"""

    def cmd_update(self, args):
        """Update one or more modules in a database"""

    def cmd_duplicate(self, args):
        """Duplicate a database"""

    def cmd_dump(self, args):
        """Dump a database"""

    def cmd_restore(self, args):
        """Restore a database"""
