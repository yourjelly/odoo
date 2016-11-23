# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import code
import logging
import os
import signal
import sys

import odoo
from odoo.conf import settings
from . import Command, OptionGroup, Option, server

_logger = logging.getLogger(__name__)


# Shell config group {{{
shell_group = OptionGroup("Database Shell Configuration", options=[
    Option('--shell-interface', dest='shell_interface', type='string',
           help="Specify a preferred REPL to use in shell mode. Supported REPLs are: [ipython|ptpython|bpython|python]"),
])
# }}}


def raise_keyboard_interrupt(*a):
    raise KeyboardInterrupt()


class Console(code.InteractiveConsole):
    def __init__(self, locals=None, filename="<console>"):
        code.InteractiveConsole.__init__(self, locals, filename)
        try:
            import readline
            import rlcompleter
        except ImportError:
            print 'readline or rlcompleter not available, autocomplete disabled.'
        else:
            readline.set_completer(rlcompleter.Completer(locals).complete)
            readline.parse_and_bind("tab: complete")


class Shell(Command):
    """Start odoo in an interactive shell"""
    supported_shells = ['ipython', 'ptpython', 'bpython', 'python']

    def console(self, local_vars):
        if not os.isatty(sys.stdin.fileno()):
            exec sys.stdin in local_vars
        else:
            if 'env' not in local_vars:
                print 'No environment set, use `%s shell -d dbname` to get one.' % sys.argv[0]
            for i in sorted(local_vars):
                print '%s: %s' % (i, local_vars[i])

            preferred_interface = settings.get('shell_interface')
            if preferred_interface:
                shells_to_try = [preferred_interface, 'python']
            else:
                shells_to_try = self.supported_shells

            for shell in shells_to_try:
                try:
                    return getattr(self, shell)(local_vars)
                except ImportError:
                    pass
                except Exception:
                    _logger.warning("Could not start '%s' shell." % shell)
                    _logger.debug("Shell error:", exc_info=True)

    def ipython(self, local_vars):
        from IPython import start_ipython
        start_ipython(argv=[], user_ns=local_vars)

    def ptpython(self, local_vars):
        from ptpython.repl import embed
        embed({}, local_vars)

    def bpython(self, local_vars):
        # https://github.com/bpython/bpython/issues/640
        from bpython import embed
        embed(local_vars)

    def python(self, local_vars):
        Console(locals=local_vars).interact()

    def shell(self, dbname):
        local_vars = {
            'openerp': odoo,
            'odoo': odoo,
        }
        with odoo.api.Environment.manage():
            if dbname:
                registry = odoo.registry(dbname)
                with registry.cursor() as cr:
                    uid = odoo.SUPERUSER_ID
                    ctx = odoo.api.Environment(cr, uid, {})['res.users'].context_get()
                    env = odoo.api.Environment(cr, uid, ctx)
                    local_vars['env'] = env
                    local_vars['self'] = env.user
                    self.console(local_vars)
            else:
                self.console(local_vars)

    def run(self, args):
        groups = [
            shell_group,
            server.db_group,
        ]
        self.parser.add_option_groups(groups)
        self.parser.parse_args(args)

        odoo.cli.server.report_configuration()
        odoo.service.server.start(preload=[], stop=True)
        signal.signal(signal.SIGINT, raise_keyboard_interrupt)

        self.shell(settings['db_name'])
        return 0
