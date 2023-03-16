# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

""" Modules dependency graph. """

import logging
# Deprecated since version 3.9:
# https://docs.python.org/3.9/library/typing.html#typing.Iterable
from typing import List, Set, Dict, Iterable
from collections import defaultdict

import odoo
import odoo.tools as tools

_logger = logging.getLogger(__name__)


class Package:
    def __init__(self, name: str, manifest: dict) -> None:
        # manifest data
        self.name = name
        self.manifest = manifest

        # ir_module_module data             # column_name
        self.id = None                         # id
        self.state = 'uninstalled'          # state
        self.dbdemo = False                 # demo
        self.installed_version = None       # latest_version

        # info for upgrade
        self.upgrade_end = False            # if the package is need to upgrade end-xxx
        self.old_version = None             # the version when added to graph

        # dependency
        self.parents: List[Package] = []
        self.children: List[Package] = []
        self.graph = None

    @tools.lazy_property
    def depth(self):
        try:
            return max((package.depth for package in self.parents), default=-1) + 1
        except RecursionError as e:  # depends loop detected
            self.graph._del_package(self.name)
            return -1

    def demo_installable(self) -> bool:
        return all(p.dbdemo for p in self.parents)


class Graph:

    def __init__(self) -> None:
        self._packages: Dict[str, Package] = {}
        self._unsorted_packages: List[Package] = []

    def __contains__(self, key: str) -> bool:
        return key in self._packages

    def __getitem__(self, item: str) -> Package:
        return self._packages[item]

    def __iter__(self) -> Iterable[Package]:
        if self._unsorted_packages:
            self._update_edges(self._unsorted_packages)
            module_package = sorted(self._packages.items(), key=lambda item: (item[1].depth, item[1].name))
            self._packages = dict((module, package) for module, package in module_package if module in self._packages)
            self._unsorted_packages = []
        return iter(self._packages.values())

    def __len__(self) -> int:
        return len(self._packages)

    def __bool__(self) -> bool:
        return bool(self._packages)

    def _update_edges(self, packages: Iterable[Package]) -> None:
        for package in packages:
            for dep in package.manifest['depends']:
                parent = self[dep]
                package.parents.append(parent)
                parent.children.append(package)

    def _del_package(self, name: str) -> None:
        if name not in self._packages:
            return
        package = self._packages.pop(name)
        for parent in package.parents:
            parent.children.remove(package)
        for child in package.children:
            self._del_package(child.name)

    def _add_package(self, name: str, manifest: dict) -> None:
        new_package = Package(name, manifest)
        self._unsorted_packages.append(new_package)
        self._packages[name] = new_package

    def add_modules(self, cr, modules: Iterable[str]) -> int:
        manifests: Dict[str, dict] = {}
        for module in modules:
            manifest = odoo.modules.module.get_manifest(module)
            if manifest and manifest['installable']:
                manifests[module] = manifest
            elif module != 'studio_customization':
                _logger.warning('module %s: not installable, skipped', module)

        missing_modules = {
            dep
            for module, manifest in manifests.items()
            for dep in manifest['depends'] if dep not in self and dep not in manifests
        }
        if missing_modules:
            unmet_modules = set()
            children = defaultdict(list)
            for module, manifest in manifests.items():
                for dep in manifest['depends']:
                    children[dep].append(module)

            # BFS
            def visit(module_: str) -> None:
                if module_ not in unmet_modules:
                    unmet_modules.add(module_)
                    del manifests[module_]
                    for child_ in children[module_]:
                        visit(child_)

            for module in missing_modules:
                for child in children[module]:
                    visit(child)

            _logger.info(
                'modules %s cannot be added to the Graph because their dependent modules %s are not added',
                ', '.join(unmet_modules), ', '.join(missing_modules)
            )

        # unmet_modules have been removed from manifests in the BFS
        for module, manifest in manifests.items():
            self._add_package(module, manifest)
            self[module].graph = self

        self.update_from_db(cr, manifests)

        return len(manifests)

    def update_from_db(self, cr, modules: Iterable[str]) -> None:
        if not modules:
            return
        # update the graph with values from the database (if exist)
        cr.execute('''
            SELECT name, id, state, demo, latest_version AS installed_version
            FROM ir_module_module
            WHERE name IN %s
        ''', (tuple(modules),))

        for name, id_, state, demo, installed_version in cr.fetchall():
            package = self[name]
            package.id = id_
            package.state = state
            package.dbdemo = demo
            package.installed_version = installed_version
            package.old_version = installed_version
            package.upgrade_end = package.state == 'to upgrade'
