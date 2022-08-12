# Part of Odoo. See LICENSE file for full copyright and licensing details.

from collections import defaultdict

from .misc import OrderedSet


class TriggerGraph:
    """ This implements a graph that represents field dependencies, and is used
    to build so-called "trigger trees", which are used to determine the
    recomputation/invalidation of computed fields after some record update.
    The graph actually represents the inverse relation of field dependencies,
    hence the name "trigger graph".

    Field dependencies are represented as edges between the dependency and
    dependent fields, and edges are optionally labelled with a relational
    field.  The various kinds of dependencies are depicted below.  When there
    are several relational fields between a field and its dependency, we
    introduce "dummy" nodes in the graph to materialize the path.

        A depends on B      A depends on B.C        A depends on B.C.D

                                    B                    B        C
          A <----- B           A <----- C           A <----- @ <----- D

    A trigger tree is built from a set of fields by recursively traversing the
    graph from those fields, until no edge can be traversed or a cycle is
    found.
    """

    def __init__(self):
        # edges {from_node: {label: to_nodes}}
        self._edges = defaultdict(lambda: defaultdict(OrderedSet))

    def add_dependency(self, field, dependency):
        """ Add a field dependency, given as a sequence of fields. """
        *path, to_field = dependency

        if not path:
            return self._edges[to_field][None].add(field)

        # make a chained list with dummy nodes between 'to_field' and 'field'
        nodes = [field, *(Dummy() for _i in range(len(path) - 1)), to_field]
        for step, to_node, from_node in zip(path, nodes, nodes[1:]):
            self._edges[from_node][step].add(to_node)

    def discard(self, fields):
        """ Discard the given fields from the graph (nodes and edges). """
        fields = set(fields)
        edges = dict(self._edges)
        self._edges.clear()
        for from_node, edges in edges.items():
            if from_node not in fields:
                for label, to_nodes in edges.items():
                    if label not in fields:
                        to_nodes -= fields
                        if to_nodes:
                            self._edges[from_node][label] = to_nodes

    def make_tree(self, fields, select=bool):
        """ Return the trigger tree corresponding to the given fields. The
        function ``select`` is called on every field to determine which fields
        should be kept in the tree nodes.  This enables to discard some
        unnecessary fields from the tree nodes.
        """
        nodes = OrderedSet(fields)
        fields = [node for node in self.transitive_closure(nodes) if node and select(node)]
        tree = {None: fields} if fields else {}
        for label, from_nodes in self.outgoing(self.full_closure(nodes)).items():
            if label is not None:
                subtree = self._make_tree(from_nodes, select)
                if subtree:
                    tree[label] = subtree
        return tree

    def _make_tree(self, nodes, select, ignore=frozenset()):
        nodes = [node for node in self.full_closure(nodes) if node not in ignore]
        fields = [node for node in nodes if node and select(node)]
        ignore = ignore | frozenset(nodes)
        tree = {None: fields} if fields else {}
        for label, from_nodes in self.outgoing(nodes).items():
            if label is not None:
                subtree = self._make_tree(from_nodes, select, ignore)
                if subtree:
                    tree[label] = subtree
        return tree

    def transitive_closure(self, nodes):
        """ Return the transitive closure of nodes by non-field edges. """
        return self._closure(nodes, False)

    def full_closure(self, nodes):
        """ Return the reflexive transitive closure of nodes by non-field edges. """
        return self._closure(nodes, True)

    def _closure(self, nodes, full):
        # implementation of the transitive closure
        nodes = list(nodes)
        result = OrderedSet(nodes) if full else OrderedSet()
        index = 0
        while index < len(nodes):
            edges = self._edges.get(nodes[index])
            if edges:
                for to_node in edges.get(None, ()):
                    if to_node not in result:
                        nodes.append(to_node)
                        result.add(to_node)
            index += 1
        return result

    def outgoing(self, nodes):
        """ Return all the nodes reachable from the given nodes, grouped by edge label. """
        result = defaultdict(OrderedSet)    # {label: to_nodes}
        for node in nodes:
            node_edges = self._edges.get(node)
            if node_edges:
                for label, to_nodes in node_edges.items():
                    result[label].update(to_nodes)
        return result


class Dummy:
    """ Falsy object to be used along with actual field objects in the graph of
    field dependencies. Those objects are considered distinct, which enables to
    have many of them inside the graph.
    """
    __slots__ = ()

    def __bool__(self):
        return False
