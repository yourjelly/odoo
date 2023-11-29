from functools import reduce
import operator

from .float_utils import float_round


class Node:
    def __init__(self, computer):
        self._computer = computer

    def eval_python(self, locals_dict):
        # TO BE OVERRIDDEN
        pass

    def to_js(self):
        # TO BE OVERRIDDEN
        pass

    def __add__(self, other):
        return AddNode(self._computer, self, other)

    def __sub__(self, other):
        return SubNode(self._computer, self, other)

    def __mul__(self, other):
        return MulNode(self._computer, self, other)

    def __floordiv__(self, other):
        return DivNode(self._computer, self, other)

    def __truediv__(self, other):
        return DivNode(self._computer, self, other)

    def __neg__(self):
        return NegNode(self._computer, self)


class ContextNode(Node):
    def __init__(self, computer, name):
        super().__init__(computer)
        self._name = name

    def get_name(self):
        return self._name

    def eval_python(self, locals_dict):
        return locals_dict[self._name]

    def to_js(self):
        return self._name


class VarNode(ContextNode):
    def __init__(self, computer, name, node):
        super().__init__(computer, name)
        self._node = node

    def get_node(self):
        return self._node


class ValueNode(Node):
    def __init__(self, computer, value):
        super().__init__(computer)
        self.value = value

    def eval_python(self, locals_dict):
        return self.value

    def to_js(self):
        return str(self.value)


class MultiVarNode(Node):
    def __init__(self, computer, *nodes):
        super().__init__(computer)
        self._nodes = nodes


class AddNode(MultiVarNode):
    def eval_python(self, locals_dict):
        return sum(var.eval_python(locals_dict) for var in self._nodes)

    def to_js(self):
        return f"({' + '.join(var.to_js() for var in self._nodes)})"


class SubNode(MultiVarNode):
    def eval_python(self, locals_dict):
        return reduce(operator.sub, [var.eval_python(locals_dict) for var in self._nodes])

    def to_js(self):
        return f"({' - '.join(var.to_js() for var in self._nodes)})"


class MulNode(MultiVarNode):
    def eval_python(self, locals_dict):
        return reduce(operator.mul, [var.eval_python(locals_dict) for var in self._nodes])

    def to_js(self):
        return f"({' * '.join(var.to_js() for var in self._nodes)})"


class DivNode(Node):
    def __init__(self, computer, op1, op2):
        super().__init__(computer)
        self._op1 = op1
        self._op2 = op2

    def eval_python(self, locals_dict):
        return self._op1.eval_python(locals_dict) / self._op2.eval_python(locals_dict)

    def to_js(self):
        return f"({self._op1.to_js()} / {self._op2.to_js()})"


class NegNode(Node):
    def __init__(self, computer, node):
        super().__init__(computer)
        self._node = node

    def eval_python(self, locals_dict):
        return -self._node.eval_python(locals_dict)

    def to_js(self):
        return f"(-{self._node.to_js()})"


class IfElseNode(Node):
    def __init__(self, computer, if_part, then_part, else_part):
        super().__init__(computer)
        self._if_part = if_part
        self._then_part = then_part
        self._else_part = else_part

    def eval_python(self, locals_dict):
        if bool(self._if_part.eval_python(locals_dict)):
            return self._then_part.eval_python(locals_dict)
        else:
            return self._else_part.eval_python(locals_dict)

    def to_js(self):
        return f"{self._if_part.to_js()} ? {self._then_part.to_js()} : {self._else_part.to_js()}"


class RoundNode(Node):
    def __init__(self, computer, value, rounding):
        super().__init__(computer)
        self._value = value
        self._rounding = rounding

    def eval_python(self, locals_dict):
        return float_round(self._value.eval_python(locals_dict), precision_rounding=self._rounding)

    def to_js(self):
        return f"round({self._value.to_js()}, {self._rounding})"


class Computer:
    def __init__(self):
        self._variables = {}
        self._var_incr = 0
        self._py_eval_context = {}

    def _next_variable(self):
        var_number = self._var_incr
        self._var_incr += 1
        return f"x{var_number}"

    def add_to_py_context(self, key, value):
        self._py_eval_context[key] = value

    def get_variable(self, name):
        return self._variables[name]

    def __getattribute__(self, item):
        try:
            return super().__getattribute__(item)
        except AttributeError:
            if item in self._py_eval_context:
                return self._py_eval_context[item]
            raise

    # ===================================================================
    # FUNCTIONS
    # ===================================================================

    def round(self, value, rounding):
        return RoundNode(self, value, rounding)

    def sum(self, *nodes):
        return AddNode(self, *nodes)

    def if_else(self, if_part, then_part, else_part):
        return IfElseNode(self, if_part, then_part, else_part)

    def create_context_node(self, name):
        context_node = ContextNode(self, name)
        self.add_to_py_context(name, context_node)
        return context_node

    def create_var(self, node, var_name=None):
        var_name = var_name or self._next_variable()
        var_node = VarNode(self, var_name, node)
        self._variables[var_name] = var_node
        return var_node

    def create_value_node(self, value):
        return ValueNode(self, value)

    # ===================================================================
    # HELPERS
    # ===================================================================

    def eval_python(self, locals_dict):
        for variable in self._variables.values():
            locals_dict[variable.get_name()] = variable.get_node().eval_python(locals_dict)
        return locals_dict

    def to_js(self):
        results = []
        for variable in self._variables.values():
            results.append((variable.get_name(), variable.get_node().to_js()))
        return results
