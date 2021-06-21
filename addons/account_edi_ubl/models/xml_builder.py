# -*- coding: utf-8 -*-

from odoo import _
from odoo.tools import float_repr
from lxml import etree


class Node:
    def __init__(self, tag, required=None, rules=None):
        self.tag = tag
        self.rules = rules or []
        self.required = required
        self.parent_node = None
        self._root_node = None

    @property
    def root_node(self):
        return self._root_node

    @root_node.setter
    def root_node(self, value):
        self._root_node = value

    def __repr__(self):
        return f"Node (tag={self.tag})"

    def get_errors(self):
        return [rule[1] for rule in self.rules or [] if not rule[0](self)]

    def build(self, nsmap, errors, parent_element=None):
        # TO BE OVERRIDDEN
        return []

    def format_tag(self, tag, nsmap):
        tag_split = tag.split(':')
        if len(tag_split) > 1:
            tag_split[0] = '{%s}' % nsmap[tag_split[0]]
        return ''.join(tag_split)

    def get_all_items(self, key, recursive=False):
        return [self] if self.tag == key else []


class Value(Node):
    def __init__(self, tag, value=None, attrs=None, internal_data=None, required=None, value_format=None, rules=None):
        super().__init__(tag, required=required, rules=rules)
        self.value = value
        self.attrs = attrs
        self.internal_data = internal_data
        self.required = required
        self.value_format = value_format

    def set_value(self, value):
        self.value = value

    def get_value(self):
        return self.value

    def __repr__(self):
        return f"Value (tag={self.tag}, value={self.value})"

    def get_errors(self):
        errors = super().get_errors()
        if self.required and self.required(self) and not self.get_value():
            errors.append(self._create_required_error_message())
        return errors

    def _create_required_error_message(self):
        return _("The xml value for tag %s could not be computed.", self.tag)

    def build(self, nsmap, errors, parent_element=None):
        value = self.get_value()
        if value is None or parent_element is None:
            return []

        element = etree.SubElement(parent_element, self.format_tag(self.tag, nsmap), attrib=self.attrs, nsmap=nsmap)
        element.text = str(self.value_format(value) if self.value_format else value)
        return [element]


class FieldValue(Value):
    def __init__(self, tag, record, fieldnames, attrs=None, internal_data=None, required=None, value_format=None, rules=None):
        self.record = record
        self.fieldnames = fieldnames
        super().__init__(
            tag,
            attrs=attrs,
            internal_data=internal_data,
            required=required,
            value_format=value_format,
            rules=rules,
        )

    def get_value(self):
        for fieldname in self.fieldnames:
            value = self.record
            for sub_fieldname in fieldname.split('.'):
                value = value[sub_fieldname]
            if value:
                return value
        return None

    def _create_required_error_message(self):
        field_displaynames = []
        for fieldname in self.fieldnames:
            sub_fieldname = fieldname.split('.')[0]
            field_displaynames.append(self.record.fields_get([sub_fieldname])[sub_fieldname]['string'])
        if len(field_displaynames) == 1:
            return _(
                "The field '%s' is required on %s.",
                field_displaynames[0],
                self.record.display_name,
            )
        else:
            return _(
                "At least one of the following fields %s is required on %s.",
                ', '.join("'%s'" % f for f in field_displaynames),
                self.record.display_name,
            )

    def __repr__(self):
        return f"Value (tag={self.tag}, fields={self.fieldnames})"


class MonetaryValue(Value):
    def __init__(self, tag, value, precision_digits, attrs=None, internal_data=None, required=None, rules=None):
        super().__init__(
            tag,
            value,
            attrs=attrs,
            internal_data=internal_data,
            required=required,
            value_format=lambda amount: float_repr(amount, precision_digits),
            rules=rules,
        )


class Parent(Node):
    def __init__(self, tag, children_nodes, attrs=None, internal_data=None, required=None, rules=None):
        super().__init__(tag, required=required, rules=rules)
        self.attrs = attrs
        self.internal_data = internal_data
        self.children_nodes = {}
        for child in children_nodes:
            self.children_nodes[child.tag] = child
            child.parent_node = self
            child.root_node = self.root_node
        self.keys = list(self.children_nodes.keys())

    @property
    def root_node(self):
        return self._root_node

    @root_node.setter
    def root_node(self, value):
        self._root_node = value

        for child in self.children_nodes.values():
            child.root_node = value

    def __getitem__(self, key):
        return self.children_nodes[key]

    def __setitem__(self, key, value):
        if key != value.tag:
            raise ValueError("Key must be the same as the value node's tag.")
        self.children_nodes[key] = value
        self.keys.append(key)
        value.parent_node = self

    def __delitem__(self, key):
        self.children_nodes[key].parent_node = None
        self.children_nodes[key].root_node = None
        del self.children_nodes[key]
        self.keys.remove(key)

    def remove(self, key):
        del self[key]

    def __iter__(self):
        return iter(self.keys)

    def __len__(self):
        return len(self.keys)

    def __repr__(self):
        nodes_repr = '{' + ', '.join('%r: %r' % (key, self.children_nodes[key]) for key in self.keys) + '}'
        return f"{self.tag}: {nodes_repr}"

    def _insert_at_index(self, index, node):
        if node.tag in self.children_nodes:
            raise ValueError('Tag already present in children nodes, use Multi to have multiple times the same Node')
        self.keys.insert(index, node.tag)
        self.children_nodes[node.tag] = node
        node.parent_node = self
        node.root_node = self.root_node

    def insert_before(self, key, node):
        i = self.keys.index(key)
        self._insert_at_index(i, node)

    def insert_after(self, key, node):
        i = self.keys.index(key) + 1
        self._insert_at_index(i, node)

    def insert_first(self, node):
        self._insert_at_index(0, node)

    def insert_last(self, node):
        self._insert_at_index(len(self.keys), node)

    def get_all_items(self, key, recursive=False):
        res = [self] if self.tag == key else []
        if recursive:
            for node in self.children_nodes.values():
                res.extend(node.get_all_items(key, recursive))
        return res

    def get_errors(self):
        errors = super().get_errors()
        for key in self.keys:
            errors.extend(self.children_nodes[key].get_errors())
        return errors

    def build(self, nsmap, errors, parent_element=None):
        if parent_element is not None:
            new_parent_element = etree.SubElement(parent_element, self.format_tag(self.tag, nsmap), attrib=self.attrs, nsmap=nsmap)
        else:
            new_parent_element = etree.Element(self.format_tag(self.tag, nsmap), attrib=self.attrs, nsmap=nsmap)

        all_sub_elements = []
        for key in self.keys:
            child = self.children_nodes[key]
            sub_elements = child.build(nsmap, errors, new_parent_element)
            if sub_elements:
                all_sub_elements += sub_elements

        if not all_sub_elements:
            if parent_element is not None:
                parent_element.remove(new_parent_element)
            return []

        return [new_parent_element]


class Multi(Node):
    def __init__(self, children_nodes, required=None, rules=None):
        assert len(children_nodes)
        tag = children_nodes[0].tag
        if any(child.tag != tag for child in children_nodes):
            raise ValueError('All childs of a multi node must have the same tag')
        super().__init__(tag, required=required, rules=rules)
        self.children_nodes = children_nodes
        for child in children_nodes:
            child.parent_node = self
            child.root_node = self.root_node

    @property
    def root_node(self):
        return self._root_node

    @root_node.setter
    def root_node(self, value):
        self._root_node = value

        for child in self.children_nodes:
            child.root_node = value

    def __getitem__(self, key):
        return self.children_nodes[key]

    def __setitem__(self, key, value):
        if value.tag != self.tag:
            raise ValueError('All childs of a multi node must have the same tag')
        self.children_nodes[key] = value
        value.parent_node = self
        value.root_node = self.root_node

    def __delitem__(self, key):
        self.children_nodes[key].parent_node = None
        self.children_nodes[key].root_node = None
        del self.children_nodes[key]

    def __iter__(self):
        return iter(self.children_nodes)

    def __len__(self):
        return len(self.children_nodes)

    def __repr__(self):
        return f"{self.tag}: {self.children_nodes.__repr__()}"

    def get_all_items(self, key, recursive=False):
        res = []
        for node in self.children_nodes:
            # Multi is not a level in the xml hierarchy, so we always go recursively.
            res.extend(node.get_all_items(key, recursive))
        return res

    def get_errors(self):
        errors = super().get_errors()
        for child in self.children_nodes:
            errors.extend(child.get_errors())
        return errors

    def build(self, nsmap, errors, parent_element=None):
        if parent_element is None:
            return []
        all_sub_elements = []
        for child in self.children_nodes:
            sub_elements = child.build(nsmap, errors, parent_element=parent_element)
            if sub_elements:
                all_sub_elements += sub_elements
        return all_sub_elements


class XmlBuilder:
    def __init__(self, root_node, nsmap):
        self.root_node = root_node
        self.nsmap = nsmap
        assert isinstance(root_node, Parent)

    @property
    def root_node(self):
        return self._root_node

    @root_node.setter
    def root_node(self, value):
        self._root_node = value
        self._root_node.root_node = value

    def __repr__(self):
        return self.root_node.__repr__()

    def get_errors(self):
        return self.root_node.get_errors()

    def build(self):
        elements = self.root_node.build(self.nsmap, [])
        root = elements[0]
        tree_str = etree.tostring(root, pretty_print=True, xml_declaration=True, encoding='UTF-8')
        return tree_str
