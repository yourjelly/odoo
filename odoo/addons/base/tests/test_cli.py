import os
import re
import sys
import subprocess as sp
import unittest
from pathlib import Path

from odoo.cli.command import commands, load_addons_commands, load_internal_commands
from odoo.tools import config, file_open
from odoo.tests import BaseCase, Like

class TestCommand(BaseCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.odoo_bin = Path(__file__).parents[4].resolve() / 'odoo-bin'
        cls.run_args = (sys.executable, cls.odoo_bin, f'--addons-path={config["addons_path"]}')

    def run_command(self, *args, check=True, capture_output=True, text=True, **kwargs):
        return sp.run(
            [*self.run_args, *args],
            capture_output=capture_output,
            check=check,
            text=text,
            **kwargs
        )

    def popen_command(self, *args, capture_output=True, text=True, **kwargs):
        if capture_output:
            kwargs['stdout'] = kwargs['stderr'] = sp.PIPE
        return sp.Popen(
            [*self.run_args, *args],
            text=text,
            **kwargs
        )

    def test_docstring(self):
        load_internal_commands()
        load_addons_commands()
        for name, cmd in commands.items():
            self.assertTrue(cmd.__doc__,
                msg=f"Command {name} needs a docstring to be displayed with 'odoo-bin help'")
            self.assertFalse('\n' in cmd.__doc__ or len(cmd.__doc__) > 120,
                msg=f"Command {name}'s docstring format is invalid for 'odoo-bin help'")

    def test_help(self):
        expected = {
            'cloc',
            'db',
            'deploy',
            'help',
            'neutralize',
            'obfuscate',
            'populate',
            'scaffold',
            'server',
            'shell',
            'start',
            'upgrade_code',
        }
        for option in ('help', '-h', '--help'):
            with self.subTest(option=option):
                actual = set()
                for line in self.run_command(option).stdout.splitlines():
                    if line.startswith("   ") and (result := re.search(r'    (\w+)\s+(\w.*)$', line)):
                        actual.add(result.groups()[0])
                self.assertGreaterEqual(actual, expected, msg="Help is not showing required commands")

    @unittest.skipIf(os.name != 'posix', '`os.openpty` only available on POSIX systems')
    def test_shell(self):

        main, child = os.openpty()

        startup_file_name = self.odoo_bin.parent / 'odoo/addons/base/tests/shell_file.txt'
        with open(startup_file_name, mode="w+", encoding="utf-8") as startup_file:
            startup_file.write("message = 'Hello from Python!'")
            startup_file.flush()

            shell = self.popen_command(
                'shell',
                '--shell-interface=python',
                '--shell-file', Path(startup_file_name).resolve(),
                stdin=main,
                close_fds=True,
            )

            with os.fdopen(child, 'w', encoding="utf-8") as stdin_file:
                stdin_file.write(
                    'print(message)\n'
                    'exit()\n'
                )
            shell.wait()

        self.assertEqual(shell.stdout.read().splitlines(), [
            Like("No environment set..."),
            Like("odoo: <module 'odoo' from '/.../odoo/__init__.py'>"),
            Like("openerp: <module 'odoo' from '/.../odoo/__init__.py'>"),
            ">>> Hello from Python!",
            '>>> '
        ])
