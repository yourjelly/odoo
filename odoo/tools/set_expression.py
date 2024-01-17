# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from __future__ import annotations
from collections.abc import Iterable


class SetDefinitions:
    """ A collection of set definitions, where each set is defined by an id, a
    name, its supersets, and the sets that are disjoint with it.  This object
    is used as a factory to create set expressions, which are combinations of
    named sets with union, intersection and complement.
    """
    def __init__(self, definitions):
        """ Initialize the object with ``definitions``, a dict which maps each
        set id to a dict with optional keys ``"ref"`` (value is the set's name),
        ``"supersets"`` (value is a collection of set ids), and ``"disjoints"``
        (value is a collection of set ids).

        Here is an example of set definitions, with natural numbers (N), integer
        numbers (Z), rational numbers (Q), real numbers (R), imaginary numbers
        (I) and complex numbers (C)::

            {
                1: {"ref": "N", "supersets": [2]},
                2: {"ref": "Z", "supersets": [3]},
                3: {"ref": "Q", "supersets": [4]},
                4: {"ref": "R", "supersets": [6]},
                5: {"ref": "I", "supersets": [6], "disjoints": [4]},
                6: {"ref": "C"},
            }
        """
        self._leaves = {}

        for leaf_id, info in definitions.items():
            ref = info['ref']
            assert ref != '*', "The set reference '*' is reserved for the universal set."
            leaf = Leaf(leaf_id, ref)
            self._leaves[leaf_id] = leaf
            self._leaves[ref] = leaf

        subsets = {leaf._id: leaf._subsets for leaf in self._leaves.values()}
        supersets = {leaf._id: leaf._supersets for leaf in self._leaves.values()}

        for leaf_id, info in definitions.items():
            for greater_id in info.get('supersets', ()):
                # transitive closure: smaller_ids <= leaf_id <= greater_id <= greater_ids
                smaller_ids = subsets[leaf_id]
                greater_ids = supersets[greater_id]
                for smaller_id in smaller_ids:
                    supersets[smaller_id].update(greater_ids)
                for greater_id in greater_ids:
                    subsets[greater_id].update(smaller_ids)

        disjoints = {leaf._id: leaf._disjoints for leaf in self._leaves.values()}

        for leaf_id, info in definitions.items():
            for distinct_id in info.get('disjoints', ()):
                # all subsets[leaf_id] are disjoint from all subsets[distinct_id]
                left_ids = subsets[leaf_id]
                right_ids = subsets[distinct_id]
                for left_id in left_ids:
                    disjoints[left_id].update(right_ids)
                for right_id in right_ids:
                    disjoints[right_id].update(left_ids)

        self.empty = Union.empty
        self.universe = Union.universe

    def parse(self, refs: str, raise_if_not_found=True) -> SetExpression:
        """ Return the set expression corresponding to ``refs``, which is a
        comma-separated list of set references optionally preceded by ``!``,
        like ``base.group_user,base.group_portal,!base.group_system``.
        """
        positives = []
        negatives = []
        for xmlid in refs.split(','):
            if xmlid.startswith('!'):
                negatives.append(~self._get_leaf(xmlid[1:], raise_if_not_found))
            else:
                positives.append(self._get_leaf(xmlid, raise_if_not_found))

        if positives:
            return Union(Inter([leaf] + negatives) for leaf in positives)
        else:
            return Union([Inter(negatives)])

    def from_ids(self, ids, keep_subsets=False) -> SetExpression:
        """ Return the set expression corresponding to given set ids. """
        if keep_subsets:
            ids = set(ids)
            ids = [leaf_id for leaf_id in ids if not any((self._leaves[leaf_id]._subsets - {leaf_id}) & ids)]
        return Union(Inter([self._leaves[leaf_id]]) for leaf_id in ids)

    def get_id(self, ref):
        """ Return a set id from its reference, or ``None`` if it does not exist. """
        if ref == '*':
            return Leaf.universe
        leaf = self._leaves.get(ref)
        return None if leaf is None else leaf._id

    def _get_leaf(self, ref, raise_if_not_found=True):
        """ Return the group object from the string.

        :param str ref: the ref of a leaf
        """
        if ref == '*':
            return Leaf.universe
        if not raise_if_not_found and ref not in self._leaves:
            return Leaf(ref)
        return self._leaves[ref]


class SetExpression:
    """ An object that represents a combination of named sets with union,
    intersection and complement.
    """
    def is_empty(self) -> bool:
        """ Returns whether ``self`` is the empty set, that contains nothing. """
        raise NotImplementedError()

    def is_universal(self) -> bool:
        """ Returns whether ``self`` is the universal set, that contains all possible elements. """
        raise NotImplementedError()

    def invert_intersect(self, factor: SetExpression) -> SetExpression:
        """ Performs the inverse operation of intersection (a sort of factorization)
        such that: ``self == result & factor``.
        """
        raise NotImplementedError()

    def __and__(self, other: SetExpression) -> SetExpression:
        raise NotImplementedError()

    def __or__(self, other: SetExpression) -> SetExpression:
        raise NotImplementedError()

    def __invert__(self) -> SetExpression:
        raise NotImplementedError()

    def matches(self, user_group_ids):
        """ Return whether the given group ids are included to ``self``. """
        raise NotImplementedError()

    def __eq__(self, other: SetExpression) -> bool:
        raise NotImplementedError()

    def __le__(self, other: SetExpression) -> bool:
        raise NotImplementedError()

    def __lt__(self, other: SetExpression) -> bool:
        raise NotImplementedError()

    def __ge__(self, other: SetExpression) -> bool:
        raise NotImplementedError()

    def __gt__(self, other: SetExpression) -> bool:
        raise NotImplementedError()

    def __hash__(self):
        raise NotImplementedError()


class Union(SetExpression):
    """ Implementation of a set expression, that represents it as a union of
    intersections of named sets or their complement.
    """
    empty = None        # empty set (defined below)
    universe = None     # universal set (defined below)

    def __init__(self, inters: Iterable[Inter] = (), optimal=False):
        if inters and not optimal:
            inters = self._combine((), inters)
        self._inters = sorted(inters, key=lambda inter: inter._key)
        self._key = tuple(inter._key for inter in self._inters)
        self._hash = hash(self._key)

    @staticmethod
    def _combine(inters: Iterable[Inter], inters_to_add: Iterable[Inter]) -> list[Inter]:
        """ Combine some existing union of intersections with extra intersections. """
        result = list(inters)

        todo = list(inters_to_add)
        while todo:
            inter_to_add = todo.pop()
            if inter_to_add.is_universal():
                return [Inter.universe]
            if inter_to_add.is_empty():
                continue

            for index, inter in enumerate(result):
                merged = inter._union_merge(inter_to_add)
                if merged is not None:
                    result.pop(index)
                    todo.append(merged)
                    break
            else:
                result.append(inter_to_add)

        return result

    def is_empty(self) -> bool:
        """ Returns whether ``self`` is the empty set, that contains nothing. """
        return not self._inters

    def is_universal(self) -> bool:
        """ Returns whether ``self`` is the universal set, that contains all possible elements. """
        return any(item.is_universal() for item in self._inters)

    def invert_intersect(self, factor: Union) -> Union:
        """ Performs the inverse operation of '&' (a sort of factorization) such that: self == result & factor. """
        if factor == self:
            return Union.universe

        rfactor = ~factor
        if rfactor.is_empty() or rfactor.is_universal():
            return None
        rself = ~self

        inters = [inter for inter in rself._inters if inter not in rfactor._inters]
        if len(rself._inters) - len(inters) != len(rfactor._inters):
            # not possible to invert the intersection
            return None

        rself_value = Union(inters)
        return ~rself_value

    def __and__(self, other: Union) -> Union:
        if self == other:
            return self
        if self.is_empty() or other.is_empty():
            return Union.empty

        return Union(
            self_inter & other_inter
            for self_inter in self._inters
            for other_inter in other._inters
        )

    def __or__(self, other: Union) -> Union:
        if self == other:
            return self
        if self.is_empty():
            return other
        if other.is_empty():
            return self
        if self.is_universal() or other.is_universal():
            return Union.universe
        inters = self._combine(self._inters, other._inters)
        return Union(inters, optimal=True)

    def __invert__(self) -> Union:
        if self.is_empty():
            return Union.universe
        if self.is_universal():
            return Union.empty

        # apply De Morgan's laws
        result, *inverses_of_inters = [
            # ~(A & B) = ~A | ~B
            Union(Inter([~leaf]) for leaf in inter._leaves)
            for inter in self._inters
        ]
        # ~(A | B) = ~A & ~B
        for inverse in inverses_of_inters:
            result = result & inverse

        return result

    def matches(self, user_group_ids):
        if self.is_empty() or not user_group_ids:
            return False
        if self.is_universal():
            return True
        user_group_ids = set(user_group_ids)
        return any(inter.matches(user_group_ids) for inter in self._inters)

    def __bool__(self):
        raise NotImplementedError()

    def __eq__(self, other: Union) -> bool:
        return self._key == other._key

    def __le__(self, other: Union) -> bool:
        if self._key == other._key:
            return True
        if self.is_universal() or other.is_empty():
            return False
        if other.is_universal() or self.is_empty():
            return True
        return all(
            any(self_inter <= other_inter for other_inter in other._inters)
            for self_inter in self._inters
        )

    def __lt__(self, other: Union) -> bool:
        return self != other and self.__le__(other)

    def __ge__(self, other: Union) -> bool:
        return other.__le__(self)

    def __gt__(self, other: Union) -> bool:
        return self != other and other.__le__(self)

    def __str__(self):
        """ Returns an intersection union representation of groups using user-readable references.

            e.g. (base.group_user & base.group_multi_company) | (base.group_portal & ~base.group_multi_company) | base.group_public
        """
        if not self._inters:
            return "~*"
        if len(self._inters) == 1:
            return str(self._inters[0])

        def wrap(term):
            return f"({term})" if "&" in term else term

        return " | ".join(wrap(str(inter)) for inter in self._inters)

    def __repr__(self):
        return repr(self.__str__())

    def __hash__(self):
        return self._hash


class Inter:
    """ Part of the implementation of a set expression, that represents an
    intersection of named sets or their complement.
    """
    empty = None        # empty set (defined below)
    universe = None     # universal set (defined below)

    def __init__(self, leaves: Iterable[Leaf] = (), optimal=False):
        if leaves and not optimal:
            leaves = self._combine((), leaves)
        self._leaves = sorted(leaves, key=lambda leaf: leaf._key)
        self._key = tuple(leaf._key for leaf in self._leaves)
        self._hash = hash(self._key)

    @staticmethod
    def _combine(leaves: Iterable[Leaf], leaves_to_add: Iterable[Leaf]) -> list[Leaf]:
        """ Combine some existing intersection of leaves with extra leaves. """
        result = list(leaves)
        for leaf_to_add in leaves_to_add:
            for index, leaf in enumerate(result):
                if leaf.isdisjoint(leaf_to_add):  # leaf & leaf_to_add = empty
                    return [Leaf.empty]
                if leaf <= leaf_to_add:  # leaf & leaf_to_add = leaf
                    break
                if leaf_to_add <= leaf:  # leaf & leaf_to_add = leaf_to_add
                    result[index] = leaf_to_add
                    break
            else:
                if not leaf_to_add.is_universal():
                    result.append(leaf_to_add)
        return result

    def is_empty(self) -> bool:
        return any(item.is_empty() for item in self._leaves)

    def is_universal(self) -> bool:
        return not self._leaves

    def matches(self, user_group_ids):
        return all(leaf.matches(user_group_ids) for leaf in self._leaves)

    def _union_merge(self, other: Inter) -> Inter | None:
        """ Return the union of ``self`` with another intersection, if it can be
        represented as an intersection. Otherwise return ``None``.
        """
        # the following covers cases like (A & B) | A -> A
        if self.is_universal() or other <= self:
            return self
        if self <= other:
            return other

        # combine complementary parts: (A & ~B) | (A & B) -> A
        if len(self._leaves) == len(other._leaves):
            opposite_index = None
            # we use the fact that _leaves are ordered
            for index, self_leaf, other_leaf in zip(range(len(self._leaves)), self._leaves, other._leaves):
                if self_leaf._id != other_leaf._id:
                    return
                if self_leaf._negative != other_leaf._negative:
                    if opposite_index is not None:
                        return  # we already have two opposite leaves
                    opposite_index = index
            if opposite_index is not None:
                leaves = list(self._leaves)
                leaves.pop(opposite_index)
                return Inter(leaves, optimal=True)

    def __str__(self):
        return " & ".join(str(leaf) for leaf in self._leaves) or "*"

    def __repr__(self):
        return repr(self.__str__())

    def __and__(self, other: Inter) -> Inter:
        if self.is_empty() or other.is_empty():
            return Inter.empty
        if self.is_universal():
            return other
        if other.is_universal():
            return self
        leaves = self._combine(self._leaves, other._leaves)
        return Inter(leaves, optimal=True)

    def __eq__(self, other: Inter) -> bool:
        return self._key == other._key

    def __le__(self, other: Inter) -> bool:
        return self._key == other._key or all(
            any(self_leaf <= other_leaf for self_leaf in self._leaves)
            for other_leaf in other._leaves
        )

    def __lt__(self, other: Inter) -> bool:
        return self != other and self <= other

    def __hash__(self):
        return self._hash


class Leaf:
    """ Part of the implementation of a set expression, that represents a named
    set or its complement.
    """
    empty = None        # empty set (defined below)
    universe = None     # universal set (defined below)

    def __init__(self, leaf_id, ref=None, negative=False):
        self._id = leaf_id
        self._ref = ref or str(leaf_id)
        self._negative = bool(negative)
        self._key = (leaf_id, self._negative)
        self._hash = hash(self._key)

        self._subsets = {leaf_id}       # all the leaf ids that are <= self
        self._supersets = {leaf_id}     # all the leaf ids that are >= self
        self._disjoints = set()         # all the leaf ids disjoint from self
        self._invert = None

    def __invert__(self):
        if self._invert is None:
            self._invert = Leaf(self._id, self._ref, negative=not self._negative)
            self._invert._invert = self
            self._invert._subsets = self._subsets
            self._invert._supersets = self._supersets
            self._invert._disjoints = self._disjoints
        return self._invert

    def is_empty(self) -> bool:
        return self._ref == '*' and self._negative

    def is_universal(self) -> bool:
        return self._ref == '*' and not self._negative

    def isdisjoint(self, other: Leaf) -> bool:
        if self._negative:
            return other <= ~self
        elif other._negative:
            return self <= ~other
        else:
            return self._id in other._disjoints

    def matches(self, user_group_ids):
        return (self._id not in user_group_ids) if self._negative else (self._id in user_group_ids)

    def __str__(self):
        return f"~{self._ref}" if self._negative else self._ref

    def __repr__(self):
        return repr(self.__str__())

    def __eq__(self, other: Leaf) -> bool:
        return self._key == other._key

    def __le__(self, other: Leaf) -> bool:
        if self.is_empty() or other.is_universal():
            return True
        elif self.is_universal() or other.is_empty():
            return False
        elif self._negative:
            return other._negative and ~other <= ~self
        elif other._negative:
            return self._id in other._disjoints
        else:
            return self._id in other._subsets

    def __lt__(self, other: Leaf) -> bool:
        return self != other and self <= other

    def __hash__(self):
        return self._hash


# constants
Leaf.universe = Leaf('*')
Leaf.empty = ~Leaf.universe

Inter.empty = Inter([Leaf.empty])
Inter.universe = Inter()

Union.empty = Union()
Union.universe = Union([Inter.universe])
