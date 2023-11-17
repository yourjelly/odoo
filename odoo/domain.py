

"""
# TODO:
- Where to manage the SQL translation? in the models.py or fields.py ?

"""

from __future__ import annotations
from collections import defaultdict
from functools import reduce
import logging
import pprint
import itertools

from typing import Any, Literal, TypeVar, Union
from collections.abc import Iterable, Reversible
from odoo import fields

from odoo.models import BaseModel
from odoo.osv.expression import FALSE_LEAF, TERM_OPERATORS_NEGATION, TRUE_LEAF
from odoo.tools.query import Query
from odoo.tools.sql import SQL

LeafType = tuple[str, str, any] | list[str, str, any] | SQL
OperatorType = Literal['!', '&', '|']
DomainType = Reversible[LeafType | OperatorType]

_logger = logging.getLogger(__name__)



# class DomainNode:
#     # Mutable object containing
#     __slots__ = ('domain_operator', 'leafs')

#     def __init__(self, domain_operator: OperatorType, leafs: list[LeafType | DomainNode]) -> None:
#         self.domain_operator = domain_operator
#         self.leafs = leafs


class Domain:
    __slots__ = ('_root', '_model')

    def __init__(self, domain: DomainType, model: BaseModel) -> None:
        self._model = model

        stack = []
        def processes_leaf(current_leaf):
            if current_leaf == '!':
                if not stack:
                    raise ValueError(f'Domain {domain} is syntactically not correct.')

                leaf = stack.pop()

                if leaf[0] == '!':  # Double negation is removed
                    stack.append(leaf[1])
                elif self._false_leaf(leaf):
                    stack.append(TRUE_LEAF)
                elif self._true_leaf(leaf):
                    stack.append(FALSE_LEAF)
                else:
                    stack.append(['!', leaf])

            elif current_leaf in ('|', '&'):
                if len(stack) < 2:
                    raise ValueError(f'Domain {domain} is syntactically not correct.')

                leaf_1 = stack.pop()
                leaf_2 = stack.pop()

                node = self._merge_node(current_leaf, leaf_1, leaf_2)
                stack.append(node)
            else:
                # TODO: Check current_leaf
                stack.append(self._normalize_leaf(current_leaf))

        for current_leaf in reversed(domain):
            processes_leaf(current_leaf)

        while len(stack) > 1:
            processes_leaf('&')

        self._root = self._optimize_node(stack[0])

    def _merge_node(self, operator: Literal['&', '|'], node_1, node_2):
        if node_1[0] == operator:
            node = node_1
            leafs_to_add = (node_2,)
        else:
            node = [operator]
            leafs_to_add = (node_1, node_2)

        simplifier = self._true_leaf if operator == '|' else self._false_leaf
        if any(simplifier(leaf) for leaf in leafs_to_add):
            return TRUE_LEAF if operator == '|' else FALSE_LEAF

        ignorer = self._false_leaf if operator == '|' else self._true_leaf
        for leaf in leafs_to_add:
            if not ignorer(leaf):
                node.append(leaf)  # modify the existing one to avoid quadratic operation

        if len(node) == 1:  # Only the operator, each leaves was falsy
            return FALSE_LEAF
        if len(node) == 2:  # Only one leaf are meaningful, push this leave directly
            return node[1]
        return node

    def _normalize_leaf(self, leaf) -> tuple[tuple[fields.Field | int, str, Any]]:
        try:
            if tuple_leaf := tuple(leaf) in (TRUE_LEAF, FALSE_LEAF):
                return tuple_leaf
            left, operator, right = leaf
            path = left.split('.', 1)
        except (AttributeError, ValueError) as e:
            raise ValueError(f"Invalid leaf {leaf}: a leaf should be have 3 elements where the two first are string") from e

        field = self._model._fields.get(path[0])
        if not field:
            raise ValueError(f"Invalid field {self._model._name}.{path[0]} in leaf {leaf}")

        if operator == '<>':
            operator = '!='
        if isinstance(right, bool) and operator in ('in', 'not in'):
            _logger.warning("The domain term '%s' should use the '=' or '!=' operator.", (leaf,))
            operator = '=' if operator == 'in' else '!='
        if isinstance(right, (list, tuple)) and operator in ('=', '!='):
            _logger.warning("The domain term '%s' should use the 'in' or 'not in' operator.", (leaf,))
            operator = 'in' if operator == '=' else 'not in'

        # anyify field path
        if len(path) > 1 and field.relational:  # skip properties
            comodel = self._model.env[field.comodel_name]
            return (field, 'any', Domain([(path[1], operator, right)], comodel))

        # property, put name into the right part
        if len(path) > 1 and field.type == 'property':
            comodel = self._model.env[field.comodel_name]
            # (field_property, 'operator', ('property_name', <right>))
            return (field, operator, (path[0], right))

        if len(path) > 1:
            raise ValueError(f"Invalid leaf {leaf}: {left} should be a valid path thought relational field")

        if operator in ('any', 'not any'):
            if not field.relational:
                raise ValueError(f"Invalid leaf {leaf}: any/not any can be only used in relational field")
            comodel = self._model.env[field.comodel_name]
            return (field, 'any', Domain(right, comodel))

        # TODO: manage False when (in/not in)
        # TODO: datetime in string => real datetime
        # TODO: OR is NULL and OR is not NULL but only for domain used for SQL
        # TODO: into FALSE_LEAF / TRUE_LEAF

        return (field, operator, right)

    def _inverse_node(self, node):
        # __invert__
        if self._is_node(node):
            ope, *leafs = node
            new_ope = '&' if ope == '|' else '|'
            inversed_leafs = []
        elif node[1] in TERM_OPERATORS_NEGATION:
            node[0], TERM_OPERATORS_NEGATION[node[1]], node[2]
        else:
            ['!', node]

    def _optimize_node(self, node):
        if not self._is_node(node):
            return node

        node_operator = node[0]

        # if node_operator == '!':
        #     inside_node = self._optimize_node(node[1])
        #     if not self._is_node(inside_node):
        #         if inside_node[1] in TERM_OPERATORS_NEGATION:
        #         # Distribute not inside the leaf and reput the leaf on stack
        #             return inside_node[0], TERM_OPERATORS_NEGATION[inside_node[1]], inside_node[2]
        #         return ['!', inside_node]
        #     if inside_node[0] == '|':
                
        #         return ['&']

            # if inside_node[0] == '&':

        merged_nodes = [node_operator]
        to_merge = {}
        def merge(field, operator, right_value, todo):
            key = (field, operator)
            if key not in to_merge:
                to_merge[key] = right_value
                merged_nodes.append((field, operator, right_value))
            else:
                to_merge[key] = todo(to_merge[key], right_value)

        for sub_node in map(self._optimize_node, itertools.islice(node, 1, None)):
            field, operator, right = sub_node

            if field.type == 'many2one' and (
                # (many2one ANY dom1) AND (many2one ANY dom2) == (many2one ANY (dom1 AND dom2))
                (node_operator == '&' and operator == 'any')
                # (many2one NOT ANY dom1) OR (many2one NOT ANY dom2) == (many2one NOT ANY (dom1 AND dom2))
                or (node_operator == '|' and operator == 'not any')
            ):
                merge(field, operator, right, lambda old, value: old.__iand__(value))
            elif (
                # (field NOT ANY dom1) AND (field NOT ANY dom2) == (field NOT ANY (dom1 OR dom2))
                (node_operator == '&' and operator == 'not any')
                # (field ANY dom1) OR (field ANY dom2) == (field ANY (dom1 OR dom2))
                or (node_operator == '|' and operator == 'any')
            ):
                merge(field, operator, right, lambda old, value: old.__ior__(value))
            else:
                # TODO: merge '=' into 'in' (also for ilike too ?)
                merged_nodes.append(sub_node)

        if len(merged_nodes) == 2:  # Only one subnode => remove operator
            return merged_nodes[1]

        return merged_nodes

    def __iand__(self, other):
        self._root = self._merge_node('&', self._root, other._root)
        return self

    def __ior__(self, other):
        self._root = self._merge_node('|', self._root, other._root)
        return self

    @classmethod
    def _false_leaf(cls, leaf):
        return (
            leaf == FALSE_LEAF
            or (leaf[1] == 'in' and not (isinstance(leaf[2], Query) or leaf[2]))
            # or (leaf[1] in ('child_of', 'parent_of') and not any(_id for _id in leaf[2]))
            # TODO: remove required field == False leafs
        )

    @classmethod
    def _true_leaf(cls, leaf):
        return (
            leaf == TRUE_LEAF
            or leaf[1] == 'not in' and not (isinstance(leaf[2], Query) or leaf[2])
            # TODO: required field != False leafs
        )

    def __repr__(self) -> str:
        return f"Domain({self.as_domain_list()!r})"

    def __str__(self) -> str:
        return pprint.pformat([self._root])

    def is_always_false(self):
        return self._root == FALSE_LEAF

    def _is_node(self, node):
        return node[0] in ('!', '|', '&')

    def _node_as_domain(self, node):
        if self._is_node(node):
            operator = node[0]
            yield operator  # There is always at least enough leaf to have one operator
            yield from itertools.repeat(operator, len(node) - 3)
            for leaf in node[1:]:
                yield from self._node_as_domain(leaf)
        elif node in (TRUE_LEAF, FALSE_LEAF):
            yield node
        else:
            field, ope, right = node
            if field.type == 'property':
                yield (f"{field.name}.{right[0]}", ope, right[1])
            elif ope in ('any', 'not any'):
                yield (field.name, ope, right.as_domain_list())
            else:
                yield (field.name, ope, right)

    def as_domain_list(self):
        return list(self._node_as_domain(self._root))

    def as_filtered_method(self, records):
        """ For filtered_domain, see https://github.com/odoo/odoo/pull/111028
        => records can be used to limit result query if happens """

    def as_query(self):
        pass
