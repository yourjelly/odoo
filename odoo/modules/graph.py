# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

""" Modules dependency graph. """
import itertools
import logging

import odoo
import odoo.tools as tools

_logger = logging.getLogger(__name__)

class Graph(dict):
    """ Modules dependency graph.

    The graph is a mapping from module name to Nodes.

    """

    def add_node(self, name, info):
        max_depth, father = 0, None
        for d in info['depends']:
            n = self.get(d) or Node(d, self, None)  # lazy creation, do not use default value for get()
            if n.depth >= max_depth:
                father = n
                max_depth = n.depth
        if father:
            return father.add_child(name, info)
        else:
            return Node(name, self, info)

    def add_modules(self, module_list):
        packages = []
        len_graph = len(self)
        for module in module_list:
            # This will raise an exception if no/unreadable descriptor file.
            # NOTE The call to load_information_from_description_file is already
            # done by db.initialize, so it is possible to not do it again here.
            info = odoo.modules.module.load_information_from_description_file(module)
            if info and info['installable']:
                packages.append((module, info)) # TODO directly a dict, like in get_modules_with_version
            elif module != 'studio_customization':
                _logger.warning('module %s: not installable, skipped', module)

        dependencies = dict([(p, info['depends']) for p, info in packages])
        current, later = set([p for p, info in packages]), set()

        while packages and current > later:
            package, info = packages.pop(0)
            deps = info['depends']

            # if all dependencies of 'package' are already in the graph, add 'package' in the graph
            if all(dep in self for dep in deps):
                if package not in current:
                    continue
                later.clear()
                current.remove(package)
                self.add_node(package, info)
            else:
                later.add(package)
                packages.append((package, info))

        for package in later:
            unmet_deps = [p for p in dependencies[package] if p not in self]
            _logger.error('module %s: Unmet dependencies: %s', package, ', '.join(unmet_deps))

        return len(self) - len_graph


    def __iter__(self):
        level = 0
        done = set(self.keys())
        while done:
            level_modules = sorted((name, module) for name, module in self.items() if module.depth==level)
            for name, module in level_modules:
                done.remove(name)
                yield module
            level += 1

    def __str__(self):
        return '\n'.join(str(n) for n in self if n.depth == 0)

class Node(object):
    """ One module in the modules dependency graph.

    Node acts as a per-module singleton. A node is constructed via
    Graph.add_module() or Graph.add_modules(). Some of its fields are from
    ir_module_module (setted by Graph.update_from_db()).

    """
    __slots__ = [
        'name', 'graph', 'info', 'children', 'depth',
        'id', 'installed_version',
        'init', 'update', 'demo',
        'load_state', 'load_version',
    ]
    def __new__(cls, name, graph, info):
        if name in graph:
            return graph[name]
        inst = graph[name] = object.__new__(cls)
        inst.name = name
        inst.graph = graph
        inst.info = info or {}
        inst.children = []
        inst.depth = 0

        inst.init = False
        inst.update = False
        inst.demo = False

        return inst

    @property
    def data(self):
        return self.info

    def add_child(self, name, info):
        node = Node(name, self.graph, info)
        node.depth = self.depth + 1
        if node not in self.children:
            self.children.append(node)
        for attr in ('init', 'update', 'demo'):
            if getattr(self, attr):
                setattr(node, attr, True)
        self.children.sort(key=lambda x: x.name)
        return node

    def __setattr__(self, name, value):
        super(Node, self).__setattr__(name, value)
        # children should be marked as init/update/demo when parent is,
        # but *not unmarked*
        if name in ('init', 'update', 'demo') and value:
            for child in self.children:
                setattr(child, name, True)
        if name == 'depth':
            for child in self.children:
                child.depth = value + 1

    def __iter__(self):
        return itertools.chain(
            self.children,
            itertools.chain.from_iterable(self.children)
        )

    def __str__(self):
        return self._pprint()

    def _pprint(self, depth=0):
        s = '%s\n' % self.name
        for c in self.children:
            s += '%s`-> %s' % ('   ' * depth, c._pprint(depth+1))
        return s

    @property
    def parents(self):
        if self.depth == 0:
            return []

        return (
            node for node in self.graph.values()
            if node.depth < self.depth
            if self in node.children
        )
