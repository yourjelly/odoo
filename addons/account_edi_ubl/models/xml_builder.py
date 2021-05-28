# -*- coding: utf-8 -*-

from odoo import _
from odoo.tools import float_repr
from lxml import etree

from functools import wraps


# TODO put this in account_edi !

# TODO if _get_xml_builder is note defined for edi_format.code or the parent it would crash.
# Guarentees the order of execution !!
def builder(code):
    def decorator(func):
        @wraps(func)
        def wrap(edi_format, *args, **kwargs):
            if 'parent_builder' in kwargs:
                # LAS : Don't take this into account if it's your first read.
                # in case parent_builder is passed as a parameter on the first call, we could say it is overridden.
                # Doesn't really make sense though, would be a hack, so maybe we should delete this and discard
                # the builder given in the parameter.
                return func(edi_format, parent_builder=kwargs['parent_builder'], *args, **kwargs)
            if edi_format.code != code:
                return False
            builder = None
            if edi_format.parent:
                for parent in edi_format.__class__.__bases__:  # find the function of the parent
                    builder = parent._get_xml_builder(edi_format.parent, *args, **kwargs)
                    if builder:
                        break
            return func(edi_format, parent_builder=builder, *args, **kwargs)
        return wrap
    return decorator


class Node:
    def __init__(self, tag, required=None):
        self.tag = tag
        self.required = required

    def build(self, nsmap, errors, parent_node=None):
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
    def __init__(self, tag, value=None, attrs=None, internal_data=None, required=None, value_format=None):
        super().__init__(tag, required=required)
        self.value = value
        self.attrs = attrs
        self.internal_data = internal_data
        self.required = required
        self.value_format = value_format

    def build(self, nsmap, errors, parent_node=None):
        value = self.get_value()
        if value is None or parent_node is None:
            return []

        element = etree.SubElement(parent_node, self.format_tag(self.tag, nsmap), attrib=self.attrs, nsmap=nsmap)
        element.text = str(self.value_format(value) if self.value_format else value)
        return [element]

    def set_value(self, value):
        self.value = value

    def get_value(self):
        return self.value


class FieldValue(Value):
    def __init__(self, tag, record, fieldnames, attrs=None, internal_data=None, required=None, value_format=None):
        self.record = record
        self.fieldnames = fieldnames
        super().__init__(
            tag,
            attrs=attrs,
            internal_data=internal_data,
            required=self._create_required_error_message if required else None,
            value_format=value_format,
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


class MonetaryValue(Value):
    def __init__(self, tag, value, precision_digits, attrs=None, internal_data=None, required=None, nsmap=None):
        super().__init__(
            tag,
            value,
            attrs=attrs,
            internal_data=internal_data,
            required=required,
            value_format=lambda amount: float_repr(amount, precision_digits),
        )


class Parent(Node):
    def __init__(self, tag, children_nodes, attrs=None, internal_data=None, required=None):
        super().__init__(tag, required=required)
        self.attrs = attrs
        self.internal_data = internal_data
        self.children_nodes = {child.tag: child for child in children_nodes}

    def build(self, nsmap, errors, parent_node=None):
        if parent_node is not None:
            new_parent_node = etree.SubElement(parent_node, self.format_tag(self.tag, nsmap), attrib=self.attrs, nsmap=nsmap)
        else:
            new_parent_node = etree.Element(self.format_tag(self.tag, nsmap), attrib=self.attrs, nsmap=nsmap)

        all_sub_elements = []
        for child in self.children_nodes.values():
            sub_elements = child.build(nsmap, errors, parent_node=new_parent_node)
            if sub_elements:
                all_sub_elements += sub_elements

        if not all_sub_elements:
            if parent_node is not None:
                parent_node.remove(new_parent_node)
            return []

        return [new_parent_node]

    def __getitem__(self, key):
        return self.children_nodes[key]

    def __setitem__(self, key, value):
        if key != value.tag:
            raise ValueError("Key must be the same as the value node's tag.")
        self.children_nodes[key] = value

    def __delitem__(self, key):
        del self.children_nodes[key]

    def __iter__(self):
        return iter(self.children_nodes)

    def __len__(self):
        return len(self.children_nodes)

    def insert_before(self, key, node):  # This is bad :(
        keys = list(self.children_nodes.keys())
        vals = list(self.children_nodes.values())
        i = keys.index(key)
        keys.insert(i, node.tag)
        vals.insert(i, node)
        self.children_nodes.clear()
        self.children_nodes.update({x: vals[i] for i, x in enumerate(keys)})

    def insert_after(self, key, node):
        keys = list(self.children_nodes.keys())
        vals = list(self.children_nodes.values())
        i = keys.index(key) + 1

        if keys[-1] != key:
            keys.insert(i, node.tag)
            vals.insert(i, node)
            self.children_nodes.clear()
            self.children_nodes.update({x: vals[i] for i, x in enumerate(keys)})
        else:
            self.children_nodes[node.tag] = node

    def get_all_items(self, key, recursive=False):
        res = [self] if self.tag == key else []
        if recursive:
            for node in self.children_nodes.values():
                res.extend(node.get_all_items(key, recursive))
        return res


class Multi(Node):
    def __init__(self, children_nodes, required=None):
        assert len(children_nodes)
        tag = children_nodes[0].tag
        if any(child.tag != tag for child in children_nodes):
            raise ValueError('All childs of a multi node must have the same tag')
        super().__init__(tag, required=required)
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

    def __getitem__(self, key):
        return self.children_nodes[key]

    def __setitem__(self, key, value):
        if value.tag != self.tag:
            raise ValueError('All childs of a multi node must have the same tag')
        self.children_nodes[key] = value

    def __delitem__(self, key):
        del self.children_nodes[key]

    def __iter__(self):
        return iter(self.children_nodes)

    def __len__(self):
        return len(self.children_nodes)

    def get_all_items(self, key, recursive=False):
        res = []
        for node in self.children_nodes:
            # Multi is not a level in the xml hierarchy, so we always go recursively.
            res.extend(node.get_all_items(key, recursive))
        return res


class XmlBuilder:
    def __init__(self, root_node, nsmap):
        self.root_node = root_node
        self.nsmap = nsmap
        assert isinstance(root_node, Parent)

    def build(self):
        elements = self.root_node.build(self.nsmap, [])
        root = elements[0]
        tree_str = etree.tostring(root, pretty_print=True, xml_declaration=True, encoding='UTF-8')
        return tree_str
