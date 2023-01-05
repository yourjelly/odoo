# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests.common import BaseCase
from odoo.tools import TriggerGraph, TriggerTree


class TestTriggerGraph(BaseCase):
    def test_closure(self):
        graph = TriggerGraph()
        graph.add_dependency('a1', ['a'])
        graph.add_dependency('a2', ['a'])
        graph.add_dependency('b', ['f', 'a'])
        graph.add_dependency('c', ['g', 'a1'])
        graph.add_dependency('c1', ['c'])
        graph.add_dependency('d', ['h', 'f', 'a'])
        graph.add_dependency('e', ['i', 'b'])
        graph.add_dependency('e', ['j', 'k', 'c1'])
        graph.add_dependency('e1', ['e'])

        self.assertEqual(graph.transitive_closure(['a']), ['a1', 'a2'])
        self.assertEqual(graph.transitive_closure(['b']), [])
        self.assertEqual(graph.transitive_closure(['c']), ['c1'])
        self.assertEqual(graph.transitive_closure(['d']), [])
        self.assertEqual(graph.transitive_closure(['e']), ['e1'])

        self.assertEqual(graph.full_closure(['a']), ['a', 'a1', 'a2'])
        self.assertEqual(graph.full_closure(['b']), ['b'])
        self.assertEqual(graph.full_closure(['c']), ['c', 'c1'])
        self.assertEqual(graph.full_closure(['d']), ['d'])
        self.assertEqual(graph.full_closure(['e']), ['e', 'e1'])

    def test_trigger_tree(self):
        graph = TriggerGraph()
        self.assertEqual(graph.make_tree(['a']), TriggerTree())

        graph.add_dependency('a1', ['a'])
        self.assertEqual(graph.make_tree(['a']), TriggerTree(['a1']))
        self.assertEqual(graph.make_tree(['a1']), TriggerTree())
        self.assertEqual(graph.make_tree(['a', 'a1']), TriggerTree(['a1']))

        graph.add_dependency('a2', ['a1'])
        self.assertEqual(graph.make_tree(['a']), TriggerTree(['a1', 'a2']))
        self.assertEqual(graph.make_tree(['a1']), TriggerTree(['a2']))
        self.assertEqual(graph.make_tree(['a', 'a1']), TriggerTree(['a1', 'a2']))
        self.assertEqual(graph.make_tree(['a', 'a2']), TriggerTree(['a1', 'a2']))

        graph.add_dependency('b', ['f', 'a'])
        self.assertEqual(graph.make_tree(['a']), TriggerTree(['a1', 'a2'], {
            'f': TriggerTree(['b']),
        }))
        self.assertEqual(graph.make_tree(['a1']), TriggerTree(['a2']))
        self.assertEqual(graph.make_tree(['a2']), TriggerTree())

        graph.add_dependency('c', ['g', 'a1'])
        self.assertEqual(graph.make_tree(['a']), TriggerTree(['a1', 'a2'], {
            'f': TriggerTree(['b']),
            'g': TriggerTree(['c']),
        }))

        graph.add_dependency('d', ['h', 'f', 'a2'])
        self.assertEqual(graph.make_tree(['a']), TriggerTree(['a1', 'a2'], {
            'f': TriggerTree(['b'], {
                'h': TriggerTree(['d']),
            }),
            'g': TriggerTree(['c']),
        }))

        graph.add_dependency('d1', ['d'])
        self.assertEqual(graph.make_tree(['a']), TriggerTree(['a1', 'a2'], {
            'f': TriggerTree(['b'], {
                'h': TriggerTree(['d', 'd1']),
            }),
            'g': TriggerTree(['c']),
        }))

    def test_trigger_tree_select(self):
        graph = TriggerGraph()
        graph.add_dependency('b', ['f', 'a'])
        graph.add_dependency('c', ['g', 'a'])
        graph.add_dependency('d', ['w', 'v', 'u', 'f', 'a'])

        self.assertEqual(graph.make_tree(['a'], 'abcd'.__contains__), TriggerTree([], {
            'f': TriggerTree(['b'], {
                'u': TriggerTree([], {
                    'v': TriggerTree([], {
                        'w': TriggerTree(['d']),
                    }),
                }),
            }),
            'g': TriggerTree(['c']),
        }))

        # discard 'b' from the tree
        self.assertEqual(graph.make_tree(['a'], 'acd'.__contains__), TriggerTree([], {
            'f': TriggerTree([], {
                'u': TriggerTree([], {
                    'v': TriggerTree([], {
                        'w': TriggerTree(['d']),
                    }),
                }),
            }),
            'g': TriggerTree(['c']),
        }))

        # discard 'd' from the tree
        self.assertEqual(graph.make_tree(['a'], 'abc'.__contains__), TriggerTree([], {
            'f': TriggerTree(['b']),
            'g': TriggerTree(['c']),
        }))

        # discard both 'b' and 'd' from the tree
        self.assertEqual(graph.make_tree(['a'], 'ac'.__contains__), TriggerTree([], {
            'g': TriggerTree(['c']),
        }))

    def test_trigger_tree_cycle(self):
        graph = TriggerGraph()
        graph.add_dependency('b', ['f', 'a'])
        graph.add_dependency('c', ['g', 'b'])
        self.assertEqual(graph.make_tree(['a']), TriggerTree([], {
            'f': TriggerTree(['b'], {
                'g': TriggerTree(['c']),
            }),
        }))

        graph.add_dependency('a', ['h', 'c'])
        self.assertEqual(graph.make_tree(['a']), TriggerTree([], {
            'f': TriggerTree(['b'], {
                'g': TriggerTree(['c'], {
                    'h': TriggerTree(['a']),
                }),
            }),
        }))
        self.assertEqual(graph.make_tree(['b']), TriggerTree([], {
            'g': TriggerTree(['c'], {
                'h': TriggerTree(['a'], {
                    'f': TriggerTree(['b']),
                }),
            }),
        }))
        self.assertEqual(graph.make_tree(['c']), TriggerTree([], {
            'h': TriggerTree(['a'], {
                'f': TriggerTree(['b'], {
                    'g': TriggerTree(['c']),
                }),
            }),
        }))

        graph.add_dependency('a', ['i', 'z'])
        self.assertEqual(graph.make_tree(['z']), TriggerTree([], {
            'i': TriggerTree(['a'], {
                'f': TriggerTree(['b'], {
                    'g': TriggerTree(['c']),
                }),
            }),
        }))

    def test_trigger_tree_recursive(self):
        graph = TriggerGraph()
        graph.add_dependency('b', ['a'])
        graph.add_dependency('b', ['f', 'b'])
        self.assertEqual(graph.make_tree(['a']), TriggerTree(['b'], {
            'f': TriggerTree(['b']),
        }))
        self.assertEqual(graph.make_tree(['b']), TriggerTree([], {
            'f': TriggerTree(['b']),
        }))
