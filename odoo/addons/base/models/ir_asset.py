# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import os

from glob import glob
from logging import getLogger

from odoo import fields, http, models


_logger = getLogger(__name__)

SCRIPT_EXTENSIONS = ['js']
STYLE_EXTENSIONS = ['css', 'scss', 'sass', 'less']
TEMPLATE_EXTENSIONS = ['xml']

APPEND_DIRECTIVE = 'append'
INCLUDE_DIRECTIVE = 'include'
PREPEND_DIRECTIVE = 'prepend'
REMOVE_DIRECTIVE = 'remove'
REPLACE_DIRECTIVE = 'replace'


def fs2web(path):
    """Converts FS path into web path"""
    return '/'.join(path.split(os.path.sep))

def get_paths(path_def, extensions):
    """
    :param path_def: the definition (glob) of file paths to match
    :param extensions: a list of extensions that found files must match
    :returns: a tuple: the addon targetted by the path definition [0] and the
              list of glob files matching the definition [1].
    """
    paths = []
    addon = path_def.split('/')[0]
    addon_manifest = http.addons_manifest.get(addon)

    if addon_manifest:
        addons_path = os.path.join(addon_manifest['addons_path'], '')[:-1]
        full_path = os.path.normpath(os.path.join(addons_path, path_def))
        paths = [path if path.split('.')[-1] in TEMPLATE_EXTENSIONS else path[len(addons_path):]
            for path in sorted(glob(full_path, recursive=True))
        ]
    else:
        addon = 'unknown'

    if not len(paths):
        paths = [path_def]

    return addon, [path
        for path in paths
        if not extensions or path.split('.')[-1] in extensions
    ]

class IrAsset(models.Model):
    """This model contributes to two things:

        1. It exposes a public function returning a list of all file paths
           declared in a given list of addons;

        2. It allows to create 'ir.asset' records to add file paths or
           attachment urls to certain asset bundles.
    """

    _name = 'ir.asset'
    _description = 'Asset'

    def _get_asset_domain(self, bundle):
        """Meant to be overridden to give additional information to the search"""
        return [('bundle', '=', bundle), ('active', '=', True)]

    name = fields.Char(string='Name', required=True)
    bundle = fields.Char(string='Bundle name', required=True)
    directive = fields.Selection(string='Directive', selection=[
        (APPEND_DIRECTIVE, 'Append'),
        (PREPEND_DIRECTIVE, 'Prepend'),
        (REMOVE_DIRECTIVE, 'Remove'),
        (REPLACE_DIRECTIVE, 'Replace'),
        (INCLUDE_DIRECTIVE, 'Include')], default=APPEND_DIRECTIVE)
    glob = fields.Char(string='File')
    target = fields.Char(string='Target')
    active = fields.Boolean(string='active', default=True)

    def get_addon_files(self, addons, bundle, css=False, js=False, xml=False, addon_files=None):
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

        # The addon_files list is only created during the
        # initial function call. It is then given to the
        # subsequent calls to allow them to add/remove files in place.
        if addon_files is None:
            addon_files = []

        def process_path(directive, target, path_def):
            """
            TODO: doc
            (hard to extract somewhere else since we need: 'addons', 'exts' and 'addon_files')
            """
            if not path_def:
                path_def = target
                target = None

            if directive == INCLUDE_DIRECTIVE:
                return self.get_addon_files(addons, path_def, css, js, xml, addon_files)

            addon, paths = get_paths(path_def, exts)

            if directive == REPLACE_DIRECTIVE:
                target_addon, target_paths = get_paths(target, exts)

                if not len(target_paths):
                    return

                target_path = target_paths[0]

                if exts and target_path.split('.')[-1] not in exts:
                    return

                if (target_addon, target_path) not in addon_files:
                    raise Exception("File %s not found in bundle %s of %s manifest" % (target_path, bundle, target_addon))

                index = addon_files.index((target_addon, target_path))
                addon_files[index:index + 1] = [(addon, path) for path in paths]
                return

            # Add or remove all file paths found
            for path in paths:
                if directive == APPEND_DIRECTIVE and (addon, path) not in addon_files:
                    addon_files.append((addon, path))
                elif directive == PREPEND_DIRECTIVE and (addon, path) not in addon_files:
                    addon_files.insert(0, (addon, path))
                elif directive == REMOVE_DIRECTIVE:
                    if (addon, path) not in addon_files:
                        raise Exception("File %s not found in bundle %s of %s manifest" % (path, bundle, addon))
                    addon_files.remove((addon, path))

        for addon in addons:
            manifest = http.addons_manifest.get(addon)

            if not manifest:
                continue

            assets = manifest.get('assets', {})
            bundle_paths = assets.get(bundle, [])

            for path_def in bundle_paths:
                directive = APPEND_DIRECTIVE
                target = None
                if type(path_def) == tuple:
                    # Additional directive given
                    if len(path_def) == 2:
                        directive, path_def = path_def
                    if len(path_def) == 3:
                        directive, target, path_def = path_def
                process_path(directive, target, path_def)

        for asset in self.sudo().search(self._get_asset_domain(bundle)):
            process_path(asset.directive, asset.target, asset.glob)

        return addon_files

    def get_mime_type(self, file):
        ext = file.split('.')[-1]
        if ext in SCRIPT_EXTENSIONS:
            return 'text/javascript'
        elif ext in STYLE_EXTENSIONS:
            return 'text/%s' % ext
        return None
