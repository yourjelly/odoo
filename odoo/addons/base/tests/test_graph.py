# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.modules.registry import Graph
from odoo.tests.common import BaseCase


class TestGraph(BaseCase):
    def test_graph(self):
        graph = Graph()
        graph.add('a1', 'a')
        graph.add('a2', 'a')
        graph.add('b', 'a', 'f')
        graph.add('b1', 'b')
        graph.add('b2', 'b')
        graph.add('c', 'a2', 'g')
        graph.add('c1', 'c')
        graph.add('c2', 'c1')
        graph.add('c3', 'c2')
        graph.add('d', 'b1', 'h')
        graph.add('d1', 'd')
        graph.add('e', 'b2', 'i')
        graph.add('e1', 'e')
        graph.add('e1', 'c2', 'j')
        graph.add('e2', 'e1')

        self.assertEqual(graph.closure(['a']), ['a', 'a1', 'a2'])
        self.assertEqual(graph.closure(['b']), ['b', 'b1', 'b2'])
        self.assertEqual(graph.closure(['c']), ['c', 'c1', 'c2', 'c3'])
        self.assertEqual(graph.closure(['d']), ['d', 'd1'])
        self.assertEqual(graph.closure(['e']), ['e', 'e1', 'e2'])

        self.assertEqual(graph.incoming(['a']), {
            None: ['a1', 'a2'],
            'f': ['b'],
        })
        self.assertEqual(graph.incoming(['a', 'a1', 'a2']), {
            None: ['a1', 'a2'],
            'f': ['b'],
            'g': ['c'],
        })
        self.assertEqual(graph.incoming(['b', 'c']), {
            None: ['b1', 'b2', 'c1'],
        })
        self.assertEqual(graph.incoming(graph.closure(['b', 'c'])), {
            None: ['b1', 'b2', 'c1', 'c2', 'c3'],
            'h': ['d'],
            'i': ['e'],
            'j': ['e1'],
        })

    def test_depends(self):
        graph = Graph()
        graph.add_depends('a1', [], 'a')
        graph.add_depends('a2', [], 'a')
        graph.add_depends('b', ['f'], 'a')
        graph.add_depends('c', ['g'], 'a1')
        graph.add_depends('c1', [], 'c')
        graph.add_depends('d', ['h', 'f'], 'a')
        graph.add_depends('e', ['i'], 'b')
        graph.add_depends('e', ['j', 'k'], 'c1')
        graph.add_depends('e1', [], 'e')

        self.assertEqual(graph.closure(['a']), ['a', 'a1', 'a2'])
        self.assertEqual(graph.closure(['b']), ['b'])
        self.assertEqual(graph.closure(['c']), ['c', 'c1'])
        self.assertEqual(graph.closure(['d']), ['d'])
        self.assertEqual(graph.closure(['e']), ['e', 'e1'])

    def test_trigger_tree(self):
        graph = Graph()
        self.assertEqual(graph.trigger_tree(['a']), {})

        graph.add_depends('a1', [], 'a')
        self.assertEqual(graph.trigger_tree(['a']), {None: ['a1']})
        self.assertEqual(graph.trigger_tree(['a1']), {})
        self.assertEqual(graph.trigger_tree(['a', 'a1']), {None: ['a1']})

        graph.add_depends('a2', [], 'a1')
        self.assertEqual(graph.trigger_tree(['a']), {None: ['a1', 'a2']})
        self.assertEqual(graph.trigger_tree(['a1']), {None: ['a2']})
        self.assertEqual(graph.trigger_tree(['a', 'a1']), {None: ['a1', 'a2']})
        self.assertEqual(graph.trigger_tree(['a', 'a2']), {None: ['a1', 'a2']})

        graph.add_depends('b', ['f'], 'a')
        self.assertEqual(graph.trigger_tree(['a']), {
            None: ['a1', 'a2'], 'f': {None: ['b']},
        })
        self.assertEqual(graph.trigger_tree(['a1']), {None: ['a2']})
        self.assertEqual(graph.trigger_tree(['a2']), {})

        graph.add_depends('c', ['g'], 'a1')
        self.assertEqual(graph.trigger_tree(['a']), {
            None: ['a1', 'a2'], 'f': {None: ['b']}, 'g': {None: ['c']},
        })

        graph.add_depends('d', ['h', 'f'], 'a2')
        self.assertEqual(graph.trigger_tree(['a']), {
            None: ['a1', 'a2'],
            'f': {None: ['b'], 'h': {None: ['d']}},
            'g': {None: ['c']},
        })

        graph.add_depends('d1', [], 'd')
        self.assertEqual(graph.trigger_tree(['a']), {
            None: ['a1', 'a2'],
            'f': {None: ['b'], 'h': {None: ['d', 'd1']}},
            'g': {None: ['c']},
        })

    def test_trigger_tree_select(self):
        graph = Graph()
        graph.add_depends('b', ['f'], 'a')
        graph.add_depends('c', ['g'], 'a')
        graph.add_depends('d', ['w', 'v', 'u', 'f'], 'a')

        self.assertEqual(graph.trigger_tree(['a'], 'abcd'.__contains__), {
            'f': {None: ['b'], 'u': {'v': {'w': {None: ['d']}}}},
            'g': {None: ['c']},
        })

        # discard 'b' from the tree
        self.assertEqual(graph.trigger_tree(['a'], 'acd'.__contains__), {
            'f': {'u': {'v': {'w': {None: ['d']}}}},
            'g': {None: ['c']},
        })

        # discard 'd' from the tree
        self.assertEqual(graph.trigger_tree(['a'], 'abc'.__contains__), {
            'f': {None: ['b']},
            'g': {None: ['c']},
        })

        # discard both 'b' and 'd' from the tree
        self.assertEqual(graph.trigger_tree(['a'], 'ac'.__contains__), {
            'g': {None: ['c']},
        })

    def test_trigger_tree_cycle(self):
        graph = Graph()
        graph.add_depends('b', ['f'], 'a')
        graph.add_depends('c', ['g'], 'b')
        self.assertEqual(graph.trigger_tree(['a']), {
            'f': {None: ['b'], 'g': {None: ['c']}},
        })

        graph.add_depends('a', ['h'], 'c')
        self.assertEqual(graph.trigger_tree(['a']), {
            'f': {None: ['b'], 'g': {None: ['c'], 'h': {None: ['a']}}},
        })
        self.assertEqual(graph.trigger_tree(['b']), {
            'g': {None: ['c'], 'h': {None: ['a'], 'f': {None: ['b']}}},
        })
        self.assertEqual(graph.trigger_tree(['c']), {
            'h': {None: ['a'], 'f': {None: ['b'], 'g': {None: ['c']}}},
        })

        graph.add_depends('a', ['i'], 'z')
        self.assertEqual(graph.trigger_tree(['z']), {
            'i': {None: ['a'], 'f': {None: ['b'], 'g': {None: ['c']}}},
        })

    def test_trigger_tree_recursive(self):
        graph = Graph()
        graph.add_depends('b', [], 'a')
        graph.add_depends('b', ['f'], 'b')
        self.assertEqual(graph.trigger_tree(['a']), {
            None: ['b'], 'f': {None: ['b']},
        })
        self.assertEqual(graph.trigger_tree(['b']), {
            'f': {None: ['b']},
        })
