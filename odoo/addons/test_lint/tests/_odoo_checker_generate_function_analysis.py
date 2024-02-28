import contextlib
import contextvars
import os
from collections import deque
from contextlib import ExitStack
from typing import Optional

import astroid
try:
    from astroid import NodeNG
except ImportError:
    from astroid.node_classes import NodeNG

import pylint.interfaces
from pylint.checkers import BaseChecker, utils
try:
    from pylint.checkers.utils import only_required_for_messages
except ImportError:
    from pylint.checkers.utils import check_messages as only_required_for_messages

FUNCTION_NAME_TRIGGER = ['execute', 'SQL']

DFTL_CURSOR_EXPR = [
    'self.env.cr', 'self._cr',  # new api
    'self.cr',  # controllers and test
    'cr',  # old api
    'odoo.tools',
    'tools'
]

SQL_WRAPPER = [
    'sql.SQL'
]


# <attribute> or <name>.<attribute> or <call>.<attribute>


def parse_version(s):
    # can't use odoo.tools.parse_version because pythonpath is screwed from
    # inside pylint on runbot
    return [s.rjust(3, '0') for s in s.split('.')]


class OdooBaseChecker(BaseChecker):
    if parse_version(pylint.__version__) < parse_version('2.14.0'):
        __implements__ = pylint.interfaces.IAstroidChecker
    name = 'odoo'

    debug = ''

    msgs = {
        'E8501': (
            'Possible SQL injection risk %s.',
            'sql-injection',
            'See http://www.bobby-tables.com try using '
            'execute(query, tuple(params))',
        )
    }

    SPECIAL_BUILTIN = { # FLAGS: attribute_parent, args, keywords + optional lambda
        'format': [True, True, True, None],
        'items': [True, False, False, lambda self, x: self.SUBSCRIPT_STACK.append('_all-nodes')],
        'join': [True, True, False, None],
        'append': [True, True, False, lambda self, x: self.SUBSCRIPT_STACK.append('_all-nodes')],
        'SQL': [False, False, False, None]
    }

    SUBSCRIPT_STACK = []

    def get_children(self, node):
        return list(node.get_children())

    def is_expr(self, node):
        return True

    def get_attribute_chain(self, node):
        if not isinstance(node.func, astroid.Attribute):
            return node.func.name
        # If the call is made on an attribute, recover the full chain
        attribute_chain = []
        current_node = node.func
        while isinstance(current_node, astroid.Attribute):
            attribute_chain.append(current_node.attrname)
            current_node = current_node.expr
        attribute_chain.append(current_node.name)
        attribute_chain.reverse()
        return ".".join(attribute_chain)

    def get_node_class(self, node):
        return str(node.__class__).split('.')[-1][:-2]

    def get_name_or_attrname(self, node):
        if isinstance(node, astroid.Attribute):
            return node.attrname
        elif isinstance(node, astroid.Name):
            return node.name

    def is_sql_execute(self, node):
        assert isinstance(node, astroid.Call)
        if self.get_name_or_attrname(node.func) in FUNCTION_NAME_TRIGGER:
            node_attr_chain = self.get_attribute_chain(node)
            node_attr_chain = '.'.join(node_attr_chain.split('.')[:-1])
            for attr_chain in DFTL_CURSOR_EXPR:
                if node_attr_chain.endswith(attr_chain):
                    return True

    def is_Arguments_safe(self, node):
        return False

    def is_AssignName_safe(self, node):
        if self.get_node_class(node.parent) == 'Tuple':
            return self.is_safe(node.parent.parent)
        return self.is_safe(node.parent)

    def is_Assign_safe(self, node):
        return self.is_safe(node.value)

    def is_AugAssign_safe(self,node):
        return self.is_all_safe([node.target.lookup(node.target.name)[1][-1], node.value])

    def is_BinOp_safe(self, node):
        return self.is_all_safe([node.left, node.right])

    def is_Call_safe(self, node):
        if (func_name := self.get_name_or_attrname(node.func)) in self.SPECIAL_BUILTIN.keys():
            check_attr_parent, check_args, check_keywords, additional_processing = self.SPECIAL_BUILTIN[func_name]
            if additional_processing:
                additional_processing(self, node)
            if check_attr_parent and not self.is_safe(node.func.expr):
                return False
            if check_args and not self.is_all_safe(node.args):
                return False
            if check_keywords and not self.is_all_safe(node.keywords):
                return False
            return True
        else:
            return False

    def is_Const(self, node):
        if isinstance(node, astroid.Const):
            return True

    def is_Dict_safe(self, node):
        if not self.SUBSCRIPT_STACK:
            return self.is_all_safe(node.elts)
        subscript = self.SUBSCRIPT_STACK.pop()
        if subscript == "_all-nodes":
            all_nodes = [node for pair in node.items for node in pair]  # flatten operation on items
            return self.is_all_safe(all_nodes)
        elif subscript == "_all_keys":
            all_keys = [pair[0] for pair in node.items]
            return self.is_all_safe(all_keys)
        elif subscript == "_all_values":
            all_values = [pair[1] for pair in node.items]
            return self.is_all_safe(all_values)
        else:
            for key, value in node.items:
                if key.value == subscript:
                    return self.is_safe(value)

    def is_FormattedValue_safe(self, node):
        return self.is_safe(node.value)

    def is_For_safe(self, node):
        return self.is_safe(node.iter)

    def is_IfExp_safe(self, node):
        return self.is_all_safe([node.body, node.orelse])

    def is_JoinedStr_safe(self, node):
        return self.is_all_safe(node.values)

    def is_Keyword_safe(self, node):
        return self.is_safe(node.value)

    def is_List_safe(self, node):
        if not self.SUBSCRIPT_STACK:
            return self.is_all_safe(node.elts)
        index = self.SUBSCRIPT_STACK.pop()
        if index == "_all-nodes":
            return self.is_all_safe(node.elts)
        elif isinstance(index, tuple):
            return self.is_all_safe(node.elts[slice(index[0], index[1])])
        else:
            return self.is_safe(node.elts[index])

    def is_Name_safe(self, node):
        assignations = list(node.lookup(node.name))[-1]  # ilookup is not reliable for complex structure, it will always provide the last assign regardless of conditional jumping
        return assignations and self.is_all_safe(assignations)

    def is_Subscript_safe(self, node):
        slice_class = self.get_node_class(node.slice)
        match slice_class:
            case 'Const':
                self.SUBSCRIPT_STACK.append(node.slice.value)
            case 'Slice':
                self.SUBSCRIPT_STACK.append((node.slice.lower and node.slice.lower.value, node.slice.upper and node.slice.upper.value,))
            case _:
                self.SUBSCRIPT_STACK.append("_all-nodes")
        return self.is_safe(node.value)

    def is_Tuple_safe(self, node):
        return self.is_all_safe(node.elts)

    def is_all_safe(self, nodes):
        return all(map(self.is_safe, nodes))

    def is_safe(self, node):
        assert not isinstance(node, list)
        match self.get_node_class(node):
            case 'Arguments':
                return self.is_Arguments_safe(node)
            case 'Assign':
                return self.is_Assign_safe(node)
            case 'AssignName':
                return self.is_AssignName_safe(node)
            case 'AugAssign':
                return self.is_AugAssign_safe(node)
            case 'BinOp':
                return self.is_BinOp_safe(node)
            case 'Call':
                return self.is_Call_safe(node)
            case 'Const':
                return True
            case 'Dict':
                return self.is_Dict_safe(node)
            case 'For':
                return self.is_For_safe(node)
            case 'FormattedValue':
                return self.is_FormattedValue_safe(node)
            case 'IfExp':
                return self.is_IfExp_safe(node)
            case 'JoinedStr':  # f-string
                return self.is_JoinedStr_safe(node)
            case 'Keyword':
                return self.is_Keyword_safe(node)
            case 'List':
                return self.is_List_safe(node)
            case 'Name':
                return self.is_Name_safe(node)
            case 'Subscript':
                return self.is_Subscript_safe(node)
            case 'Tuple':
                return self.is_Tuple_safe(node)
            case _:
                return False

    @only_required_for_messages('sql-injection')
    def visit_call(self, node):
        if os.path.basename(self.linter.current_file).startswith('test_'):
            return
        try:
            disable_test_code = {}
            for key,value in disable_test_code.items():
                if ('case' + str(key)) in self.debug:
                    if value:
                        self.add_message('sql-injection', node=node, args='')
                        return
            if self.is_sql_execute(node):
                if len(node.args) > 0 and not self.is_safe(node.args[0]):
                    self.add_message('sql-injection', node=node, args='')
            self.SUBSCRIPT_STACK = []
        except Exception:
            raise Error(self.linter.current_file + ':' + str(node.lineno))
    @only_required_for_messages('sql-injection')
    def visit_functiondef(self, node):
        pass

def register(linter):
    linter.register_checker(OdooBaseChecker(linter))
