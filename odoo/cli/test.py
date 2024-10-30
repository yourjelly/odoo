# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.cli.command import Command
from odoo.cli.server import (
    check_root_user,
    check_postgres_user,
    report_configuration
)
from odoo.tools import config


class Test(Command):
    """Start tests """

    def run(self, cmdargs):
        # self.parser.add_argument('tags', nargs='?')
        # args = self.parser.parse_args(args=cmdargs)
        config.parse_config(cmdargs, setup_logging=True)
        report_configuration()

        check_root_user()
        check_postgres_user()
