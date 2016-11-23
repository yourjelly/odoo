# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from __future__ import absolute_import, division, print_function


from . import Command, OptionGroup, Option, server


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
            server.i18n_group,
            server.security_group,
            server.advanced_group,
            server.multiprocess_group,
            server.windows_group,
            server.unexposed_group,
        ]
        self.parser.add_option_groups(groups)
        self.parser.parse_args(args)

        server.main()
