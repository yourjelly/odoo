# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import os

from glob import glob
from logging import getLogger

from odoo import fields, http, models


_logger = getLogger(__name__)

SCRIPT_EXTENSIONS = ['js', 'ts']
STYLE_EXTENSIONS = ['css', 'scss', 'sass', 'less']
TEMPLATE_EXTENSIONS = ['xml']

ADD_DIRECTIVE = 'add'
INCLUDE_DIRECTIVE = 'include'
REMOVE_DIRECTIVE = 'remove'


def fs2web(path):
    """Converts FS path into web path"""
    return '/'.join(path.split(os.path.sep))


class IrAsset(models.Model):
    """This model contributes to two things:

        1. It exposes a public function returning a list of all file paths
           declared in a given list of addons;

        2. It allows to create 'ir.asset' records to add file paths or
           attachment urls to certain asset bundles.
    """

    _name = 'ir.asset'
    _description = 'Asset'

    def _get_related_assets(self, bundle, domain=[]):
        """Meant to be overridden to give additional information to the search"""
        return self.sudo().search(domain + [
            ('bundle', '=', bundle),
            ('active', '=', True)
        ])

    name = fields.Char(string='Name', required=True)
    bundle = fields.Char(string='Bundle name', required=True)
    directive = fields.Selection(string='Directive', selection=[(ADD_DIRECTIVE, 'Add'), (REMOVE_DIRECTIVE, 'Remove'), (INCLUDE_DIRECTIVE, 'Include')], default=ADD_DIRECTIVE)
    glob = fields.Char(string='File')
    active = fields.Boolean(string='active', default=True)

    def get_addon_files(self, addons, bundle, css=False, js=False, xml=False, addon_files=None, file_cache=None):
        """
        Fetches all asset files from a given list of addons matching a certain
        bundle. The returned list is composed of tuples containing the file
        path [1] and the first addon calling it [0]. File can be retrieved
        either from the __manifest__.py of each module or from the 'ir.asset'
        module.

        :param addons: list of addon names as strings. The files returned will
                       only be contained in the given addons.
        :param bundle: name of the bundle from which to fetch the file paths
        :param css: boolean: whether or not to include style files
        :param js: boolean: whether or not to include script files
        :param xml: boolean: whether or not to include template files
        """
        exts = []
        if js:
            exts += SCRIPT_EXTENSIONS
        if css:
            exts += STYLE_EXTENSIONS
        if xml:
            exts += TEMPLATE_EXTENSIONS

        manifests = http.addons_manifest

        # The addon_files list and its related cache are only created during the
        # initial function call. The list and its cache is then given to the
        # subsequent calls to allow them to add/remove files in place.
        if addon_files is None:
            addon_files = []
            file_cache = []

        def process_path(directive, path_def):
            if directive == INCLUDE_DIRECTIVE:
                return self.get_addon_files(addons, path_def, css, js, xml, addon_files, file_cache)

            glob_paths = []
            path_addon = path_def.split('/')[0]
            path_addon_manifest = manifests.get(path_addon)

            # If the specified addon is found, we can add the files matching the glob
            if path_addon_manifest:
                addons_path = os.path.join(path_addon_manifest['addons_path'], '')[:-1]
                full_path = os.path.normpath(os.path.join(addons_path, path_def))

                for path in sorted(glob(full_path, recursive=True)) or [full_path]:
                    ext = path.split('.')[-1]
                    if not exts or ext in exts:
                        if ext not in TEMPLATE_EXTENSIONS:
                            # JS and CSS are loaded by the browser so we need
                            # the relative path, while templates are loaded
                            # directly from the file system.
                            path = path[len(addons_path):]
                        glob_paths.append(fs2web(path))

            # Add or remove all file paths found
            for file in glob_paths:
                if directive == REMOVE_DIRECTIVE and file in file_cache:
                    file_cache.remove(file)
                    [addon_files.remove((a, f)) for a, f in addon_files if f == file]
                elif directive == ADD_DIRECTIVE and file not in file_cache:
                    file_cache.append(file)
                    addon_files.append((path_addon, file))

        for addon in addons:
            manifest = manifests.get(addon)

            if not manifest:
                continue

            assets = manifest.get('assets', {})
            bundle_paths = assets.get(bundle, [])

            for path_def in bundle_paths:
                directive = ADD_DIRECTIVE
                if type(path_def) == tuple:
                    # Additional directive given
                    directive, path_def = path_def
                process_path(directive, path_def)

        for asset in self._get_related_assets(bundle):
            process_path(asset.directive, asset.glob)

        return addon_files

    def get_mime_type(self, file):
        ext = file.split('.')[-1]
        if ext in SCRIPT_EXTENSIONS:
            return 'text/javascript'
        elif ext in STYLE_EXTENSIONS:
            return 'text/%s' % ext
        return None
