# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from __future__ import absolute_import, division, print_function

import argparse
import inspect
import os
import sys
import textwrap

from . import Command
from odoo.conf import settings


class Config(Command):
    """
    Manage local Odoo configuration file

    Example for setting configuration:

        $ odoo config set -c custom/odoo.cfg --addons-path=~/custom/addons --no-database-list
    """
    def run(self, cmdargs):
        doclines = self.__doc__.strip().splitlines()
        self.parser = parser = argparse.ArgumentParser(
            prog="%s config" % sys.argv[0].split(os.path.sep)[-1],
            description=doclines[0],
            epilog=textwrap.dedent('\n'.join(doclines[1:])),
            formatter_class=argparse.RawTextHelpFormatter,
            add_help=False,
        )

        parser.add_argument("-c", "--config", dest="config", help="Specify an alternate config file"),
        subparsers = parser.add_subparsers()

        commands = {}
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

    def cmd_list(self, args):
        '''
        List configuration options
        '''
        print(settings.keys())

    def cmd_default(self, args):
        '''
        Show default configuration options values
        '''

    def cmd_create(self, args):
        '''
        Create a new configuration file
        '''

    def cmd_set(self, args):
        '''
        Set trailing options in configuration file (see example below)
        '''
        if not args:
            self.parser.error("Please specify some arguments to set")
