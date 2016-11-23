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
# shell_group = OptionGroup("Database Shell Configuration", options=[
#     Option('--shell-interface', dest='shell_interface', type='string',
#            help="Specify a preferred REPL to use in shell mode. Supported REPLs are: [ipython|ptpython|bpython|python]"),
# ])
# }}}


def export_translation():
    config = odoo.tools.config
    dbname = config['db_name']

    if config["language"]:
        msg = "language %s" % (config["language"],)
    else:
        msg = "new language"
    _logger.info('writing translation file for %s to %s', msg,
        config["translate_out"])

    fileformat = os.path.splitext(config["translate_out"])[-1][1:].lower()

    with open(config["translate_out"], "w") as buf:
        registry = odoo.modules.registry.Registry.new(dbname)
        with odoo.api.Environment.manage():
            with registry.cursor() as cr:
                odoo.tools.trans_export(config["language"],
                    config["translate_modules"] or ["all"], buf, fileformat, cr)

    _logger.info('translation file written successfully')

def import_translation():
    config = odoo.tools.config
    context = {'overwrite': config["overwrite_existing_translations"]}
    dbname = config['db_name']

    registry = odoo.modules.registry.Registry.new(dbname)
    with odoo.api.Environment.manage():
        with registry.cursor() as cr:
            odoo.tools.trans_load(
                cr, config["translate_in"], config["language"], context=context,
            )


class Translate(Command):
    """Translate"""

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
