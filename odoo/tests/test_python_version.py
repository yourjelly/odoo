import json
import logging
import py_compile
import sys

from pathlib import Path

import odoo
from odoo.tests import standalone


_logger = logging.getLogger(__name__)


@standalone('python_version')
def test_python_version(env):
    _logger.runbot('Compiling files with with python version %s', sys.version)
    failures = []
    for addons_path in [Path(p) for p in odoo.addons.__path__]:
        for f in addons_path.glob('**/*.py'):
            try:
                py_compile.compile(f, cfile='/tmp/dummy.py', doraise=True)
            except Exception as e:
                failure = {
                    'addons_path': str(addons_path),
                    'file': str(f.relative_to(addons_path)),
                    'exception': str(e)
                }
                failures.append(failure)
    sys.stdout.write(json.dumps(failures))
    if failures:
        _logger.error('Compilation failures found')
