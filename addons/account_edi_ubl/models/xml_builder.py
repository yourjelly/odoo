# -*- coding: utf-8 -*-

from odoo import _
from odoo.tools import float_repr
from lxml import etree


class Node:
    def __init__(self):
        pass

    def build(self, nsmap, errors, parent_node=None):
        # TO BE OVERRIDDEN
        return []

    def find_elements(self, tag_path):
        # TO BE OVERRIDDEN
        return []

    def find_element(self, tag_path):
        elements = self.find_elements(tag_path)
        return elements[0] if elements else None

    def build_nsmap(self, nsmap, inherited_nsmap):
        if nsmap:
            full_nsmap = dict(inherited_nsmap)
            full_nsmap.update(nsmap)
            return full_nsmap
        return inherited_nsmap

    def format_tag(self, tag, nsmap):
        tag_split = tag.split(':')
        if len(tag_split) > 1:
            tag_split[0] = '{%s}' % nsmap[tag_split[0]]
        return ''.join(tag_split)


class Value(Node):
    def __init__(self, tag, value, attrs=None, internal_data=None, required=None, nsmap=None, value_format=None):
        super().__init__()
        self.tag = tag
        self.value = value
        self.attrs = attrs
        self.internal_data = internal_data
        self.required = required
        self.nsmap = nsmap
        self.value_format = value_format

    def build(self, nsmap, errors, parent_node=None):
        if self.value is None or parent_node is None:
            return []

        nsmap = self.build_nsmap(self.nsmap, nsmap)
        element = etree.SubElement(parent_node, self.format_tag(self.tag, nsmap), attrib=self.attrs, nsmap=self.nsmap)
        element.text = str(self.value_format(self.value) if self.value_format else self.value)
        return [element]

    def find_elements(self, tag_path):
        return [self] if self.tag == tag_path else []

    def set_value(self, value):
        self.value = value


class FieldValue(Value):
    def __init__(self, tag, record, fieldnames, attrs=None, internal_data=None, required=None, nsmap=None, value_format=None):
        self.record = record
        self.fieldnames = fieldnames
        super().__init__(
            tag,
            self._get_value(),
            attrs=attrs,
            internal_data=internal_data,
            required=self._create_required_error_message if required else None,
            nsmap=nsmap,
            value_format=value_format,
        )

    def _get_value(self):
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


class MonetaryValue(Value):
    def __init__(self, tag, value, precision_digits, attrs=None, internal_data=None, required=None, nsmap=None):
        super().__init__(
            tag,
            value,
            attrs=attrs,
            internal_data=internal_data,
            required=required,
            nsmap=nsmap,
            value_format=lambda amount: float_repr(amount, precision_digits),
        )


class Parent(Node):
    def __init__(self, tag, children_nodes, attrs=None, internal_data=None, required=None, nsmap=None):
        super().__init__()
        self.tag = tag
        self.attrs = attrs
        self.internal_data = internal_data
        self.required = required
        self.nsmap = nsmap
        self.children_nodes = children_nodes

    def build(self, nsmap, errors, parent_node=None):
        nsmap = self.build_nsmap(self.nsmap, nsmap)
        if parent_node is not None:
            new_parent_node = etree.SubElement(parent_node, self.format_tag(self.tag, nsmap), attrib=self.attrs, nsmap=self.nsmap)
        else:
            new_parent_node = etree.Element(self.format_tag(self.tag, nsmap), attrib=self.attrs, nsmap=self.nsmap)

        all_sub_elements = []
        for child in self.children_nodes:
            sub_elements = child.build(nsmap, errors, parent_node=new_parent_node)
            if sub_elements:
                all_sub_elements += sub_elements

        if not all_sub_elements:
            if parent_node is not None:
                parent_node.remove(new_parent_node)
            return []

        return [new_parent_node]

    def find_elements(self, tag_path):
        tags = tag_path.split('/')
        if tags[0] != self.tag:
            return []

        tag_path = '/'.join(tags[1:])
        if not tag_path:
            return []

        elements = []
        for child in self.children_nodes:
            elements += child.find_elements(tag_path)
        return elements


class Multi(Node):
    def __init__(self, children_nodes):
        super().__init__()
        self.children_nodes = children_nodes

    def build(self, nsmap, errors, parent_node=None):
        if parent_node is None:
            return []
        all_sub_elements = []
        for child in self.children_nodes:
            sub_elements = child.build(nsmap, errors, parent_node=parent_node)
            if sub_elements:
                all_sub_elements += sub_elements
        return all_sub_elements

    def find_elements(self, tag_path):
        elements = []
        for child in self.children_nodes:
            elements += child.find_elements(tag_path)
        return elements


class XmlBuilder:
    def __init__(self, root_node):
        self.root_node = root_node
        assert isinstance(root_node, Parent)

    def build(self):
        elements = self.root_node.build({}, [])
        root = elements[0]
        tree_str = b"<?xml version='1.0' encoding='UTF-8'?>"
        tree_str += etree.tostring(root, pretty_print=True, xml_declaration=True, encoding='UTF-8')
        return tree_str

    def find_elements(self, tag_path):
        return self.root_node.find_elements(tag_path)

    def find_element(self, tag_path):
        return self.root_node.find_element(tag_path)
