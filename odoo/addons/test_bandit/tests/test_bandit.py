# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
try:
    import bandit
except ImportError:
    bandit = None
from odoo import tools
import subprocess
import os
from os.path import join
from distutils.version import LooseVersion
from odoo.tests.common import TransactionCase
from odoo.modules import get_modules, get_module_path

HERE = os.path.dirname(os.path.realpath(__file__))

_logger = logging.getLogger(__name__)


class TestBandit(TransactionCase):

    def _skip_test(self, reason):
        _logger.warn(reason)
        self.skipTest(reason)

    def test_bandit(self):
        if bandit is None:
            self._skip_test('please install bandit')
        required_bandit_version = LooseVersion('1.4.1')
        if LooseVersion(getattr(bandit, '__version__', '0.0.1')) < required_bandit_version:
            self._skip_test('please upgrade bandit to >= %s' % required_bandit_version)

        paths = [tools.config['root_path']]
        for module in get_modules():
            module_path = get_module_path(module)
            if not module_path.startswith(join(tools.config['root_path'], 'addons')):
                paths.append(module_path)
        options = [
            '--recursive',
            '--skip=B703,B702,B701,B611,B610,B201',
            '--number=0',
            '--format=custom',
            "--msg-template='{relpath}:{line}: {test_id}: Severity {severity}: Confidence {confidence}: {msg}'",
        ]
        pypath = HERE + os.pathsep + os.environ.get('PYTHONPATH', '')
        env = dict(os.environ, PYTHONPATH=pypath)
        try:
            bandit_bin = tools.which('bandit')
            process = subprocess.Popen(
                [bandit_bin] + options + paths,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                env=env,
            )
        except (OSError, IOError):
            self._skip_test('bandit executable not found in the path')
        else:
            out, err = process.communicate()
            if process.returncode:
                result = (b"\n" + out + b"\n" + err).decode('utf-8').strip()
                self.fail("bandit test failed:\n" + result)
