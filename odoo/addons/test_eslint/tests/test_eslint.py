# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
from odoo import tools
import subprocess
import os
from os.path import join
from odoo.tests.common import TransactionCase
from odoo.modules import get_modules, get_module_path

HERE = os.path.dirname(os.path.realpath(__file__))

_logger = logging.getLogger(__name__)


class TestEsLint(TransactionCase):

    def _skip_test(self, reason):
        _logger.warn(reason)
        self.skipTest(reason)

    def test_eslint(self):
        paths = [tools.config['root_path']]
        for module in get_modules():
            module_path = get_module_path(module)
            if not module_path.startswith(join(tools.config['root_path'], 'addons')):
                for root, subFolder, files in os.walk(module_path):
                    subFolder[:] = [d for d in subFolder if not d.startswith('lib')]
                    for file in files:
                        if file.endswith(".js"):
                            paths.append(root)

        options = [
            '--config=%s' % (join(HERE, '../config/eslintrc.js')),
            '--ext=.js',
            '--ignore-path=%s' % (join(HERE, 'eslintignore.js')),
            '--no-eslintrc',
            '--format=%s' % (join(HERE, 'table.js'))
        ]
        pypath = HERE + os.pathsep + os.environ.get('PYTHONPATH', '')
        env = dict(os.environ, PYTHONPATH=pypath)
        try:
            eslint_bin = tools.which('eslint')
            process = subprocess.Popen(
                [eslint_bin] + options + paths,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                env=env,
            )
        except (OSError, IOError):
            self._skip_test('eslint executable not found in the path')
        else:
            out, err = process.communicate()
            if process.returncode:
                self.fail("eslint test failed:\n" + (b"\n" + out + b"\n" + err).decode('utf-8').strip())
