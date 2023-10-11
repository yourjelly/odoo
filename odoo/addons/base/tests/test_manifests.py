# Part of Odoo. See LICENSE file for full copyright and licensing details.

import glob
import logging
from ast import literal_eval
from os.path import join as opj

from odoo.modules import get_modules
from odoo.modules.module import _DEFAULT_MANIFEST, module_manifest, get_module_path
from odoo.tests import BaseCase, CrossModule
from odoo.tools.misc import file_open, file_path

_logger = logging.getLogger(__name__)

MANIFEST_KEYS = {
    'name', 'icon', 'addons_path', 'license',  # mandatory keys
    *_DEFAULT_MANIFEST,                        # optional keys
    'contributors', 'maintainer', 'url',       # unused "informative" keys
}


class ManifestLinter(BaseCase, CrossModule):

    def _load_manifest(self, module):
        """Do not rely on odoo/modules/module -> load_manifest
        as we want to check manifests content, independently of the
        values from _DEFAULT_MANIFEST added automatically by load_manifest
        """
        mod_path = get_module_path(module, downloaded=True)
        manifest_file = module_manifest(mod_path)

        manifest_data = {}
        with file_open(manifest_file, mode='r') as f:
            manifest_data.update(literal_eval(f.read()))

        return manifest_data

    def test_manifests(self):
        manifest_data = self._load_manifest(self.test_module)
        self._test_manifest_keys(self.test_module, manifest_data)
        self._test_manifest_values(self.test_module, manifest_data)
        self._test_unused_data(manifest_data)

    def _test_manifest_keys(self, module, manifest_data):
        manifest_keys = manifest_data.keys()
        unknown_keys = manifest_keys - MANIFEST_KEYS
        self.assertEqual(unknown_keys, set(), f"Unknown manifest keys in module {module!r}. Either there are typos or they must be white listed.")

    def _test_manifest_values(self, module, manifest_data):
        verified_keys = [
            'application', 'auto_install',
            'summary', 'description', 'author',
            'demo', 'data', 'test',
            # todo installable ?
        ]

        if 'countries' in manifest_data and 'l10n' not in module:
            _logger.warning(
                "Module %s specific to certain countries %s should contain `l10n` in their name.",
                module, manifest_data['countries'])

        for key in manifest_data:
            value = manifest_data[key]
            if key in _DEFAULT_MANIFEST:
                if key in verified_keys:
                    self.assertNotEqual(
                       value,
                        _DEFAULT_MANIFEST[key],
                        f"Setting manifest key {key} to the default manifest value for module {module!r}. "
                        "You can remove this key from the dict to reduce noise/inconsistencies between manifests specifications"
                        " and ease understanding of manifest content."
                    )

                expected_type = type(_DEFAULT_MANIFEST[key])
                if not isinstance(value, expected_type):
                    if key != 'auto_install':
                        _logger.warning(
                            "Wrong type for manifest value %s in module %s, expected %s",
                            key, module, expected_type)
                    elif not isinstance(value, list):
                        _logger.warning(
                            "Wrong type for manifest value %s in module %s, expected bool or list",
                            key, module)
                else:
                    if key == 'countries':
                        self._test_manifest_countries_value(module, value)
            elif key == 'icon':
                self._test_manifest_icon_value(module, value)

    def _test_manifest_icon_value(self, module, value):
        self.assertTrue(
            isinstance(value, str),
            f"Wrong type for manifest value icon in module {module!r}, expected string",
        )
        self.assertNotEqual(
            value,
            f"/{module}/static/description/icon.png",
            f"Setting manifest key icon to the default manifest value for module {module!r}. "
            "You can remove this key from the dict to reduce noise/inconsistencies between manifests specifications"
            " and ease understanding of manifest content."
        )
        if not value:
            _logger.warning(
                "Empty value specified as icon in manifest of module %r."
                " Please specify a correct value or remove this key from the manifest.",
                module)
        else:
            path_parts = value.split('/')
            try:
                file_path(opj(*path_parts[1:]))
            except FileNotFoundError:
                _logger.warning(
                    "Icon value specified in manifest of module %s wasn't found in given path."
                    " Please specify a correct value or remove this key from the manifest.",
                    module)

    def _test_manifest_countries_value(self, module, values):
        for value in values:
            if value and len(value) != 2:
                _logger.warning(
                    "Country value %s specified for the icon in manifest of module %s doesn't look like a country code"
                    "Please specify a correct value or remove this key from the manifest.",
                    value, module)

    def _test_unused_data(self, manifest_data):
        lazy_loaded = {
            "point_of_sale" : [
                "data/point_of_sale_onboarding.xml", # loaded manually post_init
            ],
            "pos_restaurant" : [
                "data/pos_restaurant_onboarding.xml",  # similar to demo data, loaded on demand
                "data/pos_restaurant_onboarding_open_session.xml",   # similar to demo data, loaded on demand
            ],
            "pos_restaurant_preparation_display" : [
                "data/pos_restaurant_preparation_display_onboarding.xml",  # similar to demo data, loaded on demand
                "data/main_restaurant_preparation_display_data.xml",  # loaded manually post_init
                "data/pos_restaurant_preparation_display_demo.xml",  # loaded manually post_init
            ],
            "product_unspsc" : [
                "data/product_data.xml",  # loaded manually post_init
                "demo/product_demo.xml",  # loaded manually post_init
            ],
        }
        to_fix = {
            "mrp_workorder_hr_account" : [
                "report/cost_structure_report.xml",  # TODO whe
                "report/mrp_report_views.xml",  # TODO whe
            ],

            "website_event" : [
                "data/event_registration_answer_demo.xml", # TODO pko
            ],
            "microsoft_calendar" : [
                "security/microsoft_calendar_security.xml",  # TODO gdpf
            ],
        }

        module_path = file_path(self.test_module)
        manifests_data_paths = set(manifest_data.get('data', []))
        manifests_demo_paths = set(manifest_data.get('demo', []))
        all_data_path = manifests_demo_paths | manifests_data_paths
        awaiting_fix = to_fix.get(self.test_module, [])
        lazy = lazy_loaded.get(self.test_module, [])
        for file in glob.glob(f'{module_path}/*/**/*.xml', recursive=True):
            local_path = file[len(module_path)+1:]
            if local_path.startswith('test'):
                continue
            if local_path.startswith('static'):
                continue
            if local_path in all_data_path:
                continue
            if local_path in lazy:
                lazy.remove(local_path)
                continue
            if local_path in awaiting_fix:
                awaiting_fix.remove(local_path)
                continue
            _logger.warning('%s looks unused', opj(self.test_module, local_path))
        if awaiting_fix:
            _logger.error('Some file are marked as awaiting but were not found: %s', awaiting_fix)
        if lazy:
            _logger.error('Some file are marked as lazy loaded but were not found: %s', lazy)


    def test_unused_models(self):
        pass

    def test_unused_tests(self):
        pass

