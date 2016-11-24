# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from __future__ import absolute_import, division, print_function

import os

from . import Command, OptionGroup, Option, server
from .translate import import_translation, export_translation, i18n_group


# Legacy options {{{
legacy_group = OptionGroup("Legacy options")
legacy_group.add_options([
    Option("-s", "--save", action="store_true", dest="save", default=False, save=False, help="save configuration file"),

])
legacy_group.check(lambda opts: not opts.save and opts.config and not os.access(opts.config, os.R_OK),
                   "The config file '{0.config}' selected with -c/--config doesn't exist or is not readable, "
                   "use -s/--save if you want to generate it")
# }}}


class Server_Legacy(Command):
    hidden = True  # hides this entry in the main help screen listing the commands

    """Start the odoo server with legacy options"""
    def run(self, args):
        groups = [
            server.db_group,
            server.common_group,
            server.http_group,
            server.web_group,
            server.testing_group,
            server.logging_group,
            server.smtp_group,
            i18n_group,
            server.security_group,
            server.advanced_group,
            server.multiprocess_group,
            server.windows_group,
            server.unexposed_group,
            legacy_group,
        ]
        self.parser.add_option_groups(groups)
        opt = self.parser.parse_args(args)

        if opt.translate_in or opt.translate_out:
            server.bootstrap()
            if opt.translate_out:
                export_translation()
            elif opt.translate_in:
                import_translation()
        else:
            server.main()
