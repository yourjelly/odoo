# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
import os
import re
import ast

from odoo.tests.common import TransactionCase
from odoo import tools
from odoo.modules import get_modules, get_module_path, module

HERE = os.path.dirname(os.path.realpath(__file__))

_logger = logging.getLogger(__name__)


class TestPyImportManifest(TransactionCase):

    def test_import(self):
        paths = {}
        for module_name in get_modules():
            paths[module_name] = get_module_path(module_name)

        reg = re.compile(r"\s*from odoo.addons([.])([^\s.]+).*( import .*)?")

        # get depends in manifest

        module_manifest_depends = {}
        for module_name in list(paths):
            path = paths[module_name]
            for MANIFEST_NAME in module.MANIFEST_NAMES:
                manifest_path = os.path.join(path, MANIFEST_NAME)
                if os.path.exists(manifest_path):
                    with open(manifest_path, encoding="utf-8") as f:
                        manifest_data = ast.literal_eval(f.read())
                        module_manifest_depends[module_name] = manifest_data.get('depends', [])
                        if manifest_data.get('installable') is False:
                            paths.pop(module_name)

        module_depends = {}
        def get_depends(module_name):
            if module_name not in module_depends:
                depends = set()
                for mod in module_manifest_depends[module_name]:
                    depends.add(mod)
                    depends.update(get_depends(mod))
                module_depends[module_name] = depends
            return module_depends[module_name]
        for module_name in list(module_manifest_depends):
            get_depends(module_name)

        # get depends from import

        errors = []
        for module_name, path in paths.items():
            imported_addons = set()
            for (dirpath, _dirnames, filenames) in os.walk(path):
                for filename in filenames:
                    if not filename.endswith('.py'):
                        continue
                    if filename.startswith('test_') or '/tests' in dirpath or '/migrations' in dirpath or '/populate' in dirpath:
                        continue
                    if not os.path.isfile(os.path.join(dirpath, '__init__.py')):
                        continue
                    with open(os.path.join(dirpath, filename), encoding="utf-8") as f:
                        for line in f:
                            imported = reg.match(line)
                            if not imported:
                                continue
                            if not imported[1]:
                                _logger.warning('Undefined import format %s', line)
                                continue
                            imported_addons.add(imported[2])
            missing = imported_addons - {module_name} - module_depends[module_name]
            if missing:
                errors.append((module_name, missing))

        if errors:
            _logger.error('Some files imported in python do not match the manifest:\n%s',
                          '\n'.join(f'{module_name!r}: {missing!r}' for module_name, missing in errors))
