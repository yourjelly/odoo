import ast
import inspect
import textwrap


# -------------------------------------------------------------------------
# PARSER
# -------------------------------------------------------------------------


def convert_to_ast(py_function):
    source = inspect.getsource(py_function)
    return ast.parse(textwrap.dedent(source)).body[0]


# -------------------------------------------------------------------------
# OPTIONS
# -------------------------------------------------------------------------


class Options:
    def __init__(self):
        self.eval_context = {}

    def add_to_eval_context(self, to_map, target):
        self.eval_context[to_map] = target


# -------------------------------------------------------------------------
# CONVERTER
# -------------------------------------------------------------------------


def convert_ast_add(node, options):
    return "+"


def convert_ast_arg(node, options):
    return node.arg


def convert_ast_arguments(node, options):
    return ", ".join(convert(arg_node) for arg_node in node.args)


def convert_ast_assign(node, options):
    targets = " = ".join(convert(target, options) for target in node.targets)
    return f"let {targets} = {convert(node.value, options)};"


def convert_ast_bin_op(node, options):
    return f"{convert(node.left)} {convert(node.op)} {convert(node.right)}"


def convert_ast_constant(node, options):
    return str(node.value)


def convert_ast_function_def(node, options):
    signature = f"function {node.name}({convert(node.args)})"
    content = "".join(convert(body_node) for body_node in node.body)
    return signature + "{" + content + "}"


def convert_ast_lambda(node, options):
    args = convert(node.args, options)
    return f"({args}) => {convert(node.body, options)}"


def convert_ast_name(node, options):
    return node.id


def convert_ast_return(node, options):
    return f"return {convert(node.value)};"


NODE_MAPPING = {
    ast.Add: convert_ast_add,
    ast.arg: convert_ast_arg,
    ast.arguments: convert_ast_arguments,
    ast.Assign: convert_ast_assign,
    ast.BinOp: convert_ast_bin_op,
    ast.Constant: convert_ast_constant,
    ast.FunctionDef: convert_ast_function_def,
    ast.Lambda: convert_ast_lambda,
    ast.Name: convert_ast_name,
    ast.Return: convert_ast_return,
}


def convert(node, options=None):
    options = options or Options()
    return NODE_MAPPING[node.__class__](node, options)


# -------------------------------------------------------------------------
# TESTS
# -------------------------------------------------------------------------


def aprint(aaa):
    bbb = aaa + 5
    return bbb

# print(convert(convert_to_ast(aprint)))

bin_op = ast.BinOp()
bin_op.left = ast.Constant(10)
bin_op.op = ast.Add
bin_op.right = ast.Constant(5)
expr = ast.expr()
expr.value = bin_op
mod = ast.Module()
mod.body = [expr]
mod.type_ignores = []

bin_op2 = ast.parse(textwrap.dedent("5 + 10"))
print(ast.unparse(mod))
