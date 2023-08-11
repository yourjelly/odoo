from dateutil.relativedelta import relativedelta
from email.message import EmailMessage
from enum import EnumMeta
from freezegun.api import FakeDateMeta
from odoo.tools.json import JSON
from psycopg2 import OperationalError
from unittest.mock import Mock, MagicMock

import ast
import datetime
import functools
import logging
import odoo
import types
import werkzeug

_logger = logging.getLogger(__name__)

unsafe_eval = eval

# Some modules written in C (e.g. `time`) can imports other modules by indirect calls to `PyImport_Import`.
# This C function imports module via `__import__` present in the global scope of the current execution environment.
# _ALLOWED_MODULES is a whitelist of modules that can be imported by the `__import__` present in the sandboxed environment.
#
# For example, `time.strptime` requires the `_strptime` module to be imported.
# https://github.com/python/cpython/blob/4075e0166fcae0eef5e3abe1a97b3c227ce6861c/Modules/timemodule.c#L892
_ALLOWED_MODULES = ['_strptime', 'math', 'time']

def _import(name, globals=None, locals=None, fromlist=None, level=-1): # noqa: A002 (Reason: legacy) # pylint: disable=redefined-builtin
    if globals is None:
        globals = {}  # noqa: A001 (Reason: legacy)
    if locals is None:
        locals = {} # noqa: A001 (Reason: legacy)
    if fromlist is None:
        fromlist = []
    if name in _ALLOWED_MODULES:
        return __import__(name, globals, locals, fromlist, level)
    raise ImportError(name)


# List of builtins that are safe to be used in eval
_BUILTINS = {
    '__import__': _import,
    'abs': abs,
    'all': all,
    'any': any,
    'bool': bool,
    'bytes': bytes,
    'chr': chr,
    'dict': dict,
    'divmod': divmod,
    'enumerate': enumerate,
    'Exception': Exception,
    'False': False,
    'filter': filter,
    'float': float,
    'int': int,
    'isinstance': isinstance,
    'len': len,
    'list': list,
    'map': map,
    'max': max,
    'min': min,
    'None': None,
    'ord': ord,
    'range': range,
    'reduce': functools.reduce,
    'repr': repr,
    'round': round,
    'set': set,
    'sorted': sorted,
    'str': str,
    'sum': sum,
    'True': True,
    'tuple': tuple,
    'unicode': str,
    'xrange': range,
    'zip': zip,
}

class CheckerWrapper:
    """Wraps an object that can return / contain objects that can't be checked at compile time.
    Those objects are checked at runtime by hijacking dunder methods.

    Raises a :exc:`NameError` if the object is accessing a forbidden name.

    :param obj: is an object of any type that needs to be wrapped.
    :param type_checker: is the function used to check the type of the object.
                 The function has to follow the following signature: `type_checker(obj)`.
                 You can refer to the :func:`__call_checker` function in this module for further documentation.
    """

    def __init__(self, obj, type_checker):
        if isinstance(obj, _wrapped_instances) or (type(obj) is type and obj in _wrapped_types) or type(obj) is types.ModuleType and obj.__name__ in _ALLOWED_MODULES:  # noqa: E721 (Reason: `type(...) is ...` is stricter than `isinstance(..., ...)` in this case) # pylint: disable=unidiomatic-typecheck
            self.__obj = obj
        else:
            self.__obj = type_checker(obj)

        self.__type_checker = type_checker

    def __getitem__(self, item):
        self.__type_checker(item)
        return self.__type_checker(self.__obj.__getitem__(item))

    def __setitem__(self, key, value):
        self.__type_checker(key)
        self.__type_checker(value)

        if isinstance(key, str) and "__" in key:
            raise NameError(f"Forbidden name '{key}'.")

        self.__obj.__setitem__(key, value)

    def __call__(self, *args, **kwargs):
        for arg in (*args, *kwargs.values()):
            self.__type_checker(arg)

        return self.__type_checker(self.__obj(*args, **kwargs))

    def __getattr__(self, name):
        if "__" in name and not name.endswith("__"):
            raise NameError(f"Forbidden name '{name}'.")

        obj = super().__getattribute__("_CheckerWrapper__obj")

        if isinstance(obj, str) and name in ("format", "format_map"):
            raise SyntaxError("format method is forbidden on strings.")


        return self.__type_checker(getattr(obj, name))


# Set of the types that are allowed to be used in eval
# Almost all of them are builtin types
_ALLOWED_TYPES = frozenset({
    bool,
    bytes,
    complex,
    datetime.date,
    datetime.datetime,
    datetime.time,
    datetime.timedelta,
    dict,
    enumerate,
    filter,
    float,
    int,
    JSON,
    list,
    map,
    odoo.exceptions.UserError,
    range,
    relativedelta,
    reversed,
    set,
    slice,
    str,
    tuple,
    zip,
})

# Set of the instances that are allowed
# This means that the value of their __class__ attributes are denied,
# Which means that they can't be re-created
_ALLOWED_INSTANCES = frozenset({
    EmailMessage,
    EnumMeta,
    FakeDateMeta,
    odoo.api.Environment,
    odoo.models.BaseModel,
    odoo.models.NewId,
    odoo.sql_db.Cursor,
    types.GeneratorType,
    CheckerWrapper,

    type({}.items()),   # <class 'dict_items'>
    type({}.keys()),    # <class 'dict_keys'>
    type({}.values()),  # <class 'dict_values'>
    type(None),         # <class 'NoneType'>
 } | _ALLOWED_TYPES)

# Set of the nodes that are allowed in mathemathical expressions
_MATH_NODES = frozenset({
    # Roots node, they are required in all cases
    ast.Expr,
    ast.Module,

    ast.Constant,   # 1, 2, 3, ...

    ast.Add,        # +
    ast.And,        # and
    ast.BinOp,      # x + y
    ast.BitAnd,     # &
    ast.BitOr,      # |
    ast.BitXor,     # ^
    ast.BoolOp,     # x and y
    ast.Div,        # /
    ast.Eq,         # ==
    ast.FloorDiv,   # //
    ast.Gt,         # >
    ast.GtE,        # >=
    ast.In,         # in
    ast.Invert,     # ~
    ast.Is,         # is
    ast.IsNot,      # is not
    ast.LShift,     # <<
    ast.Lt,         # <
    ast.LtE,        # <=
    ast.Mod,        # %
    ast.Mult,       # *
    ast.Not,        # not
    ast.NotEq,      # !=
    ast.NotIn,      # not in
    ast.Or,         # or
    ast.Pow,        # **
    ast.RShift,     # >>
    ast.Sub,        # -
    ast.UAdd,       # +x
    ast.UnaryOp,    # -x
    ast.USub,       # -x
})

# Set of the nodes that are allowed in all other expressions
# With addition of the math nodes
_ALLOWED_NODES = frozenset({
    # Context node, they are required in all cases
    ast.Load,
    ast.Store,

    # General keywords
    ast.Assign,         # x = 1
    ast.AugAssign,      # +=
    ast.Break,          # break
    ast.Compare,        # x < y
    ast.comprehension,  # for x in range(10) (in list comprehension for example)
    ast.Continue,       # continue
    ast.Dict,           # { x: x }
    ast.DictComp,       # { x: x for x in range(10) }
    ast.ExceptHandler,  # try: ... except Exception as e: ...
    ast.For,            # for x in range(10): ...
    ast.FormattedValue, # f"{x}"
    ast.FunctionDef,    # def foo(): ...
    ast.GeneratorExp,   # (x for x in range(10))
    ast.If,             # if x: ...
    ast.IfExp,          # x if x else y
    ast.JoinedStr,      # f"{'x'}"
    ast.Lambda,         # lambda x: x
    ast.List,           # [1, 2, 3]
    ast.ListComp,       # [x for x in range(10)]
    ast.Pass,           # pass
    ast.Raise,          # raise Exception()
    ast.Return,         # return x
    ast.Set,            # {1, 2, 3}
    ast.SetComp,        # {x for x in range(10)}
    ast.Slice,          # x[1:2]
    ast.Subscript,      # x[1]
    ast.Try,            # try: ...
    ast.Tuple,          # (1, 2, 3)
    ast.While,          # while x: ...

    ast.arg,            # def foo(x): ... (x is an arg)
    ast.arguments       # def foo(x): ... ([x] is an arguments, it's a list of args)
} | _MATH_NODES)

# Set of the types that are allowed to be called
_CALLABLE_TYPES = frozenset({
    types.BuiltinFunctionType,      # print, len, ...
    types.BuiltinMethodType,        # [].append, int.from_bytes, ...
    types.FunctionType,             # lambda, def, ...
    types.MethodType,               # foo.bar(), ...
    types.MethodDescriptorType,     # str.join(), ...
    types.LambdaType,               # lambda, ...
    types.GeneratorType,            # (x for x in range(10)), ...
    functools.partial,              # functools.partial, ...
})

# Tuple of types that we allow to create instances of
# But we don't trust their attributes
# So we wrap them in a CheckerWrapper
_wrapped_types = (
    Exception,
) + tuple(_CALLABLE_TYPES)

# Tuple of instances that we allow to be used in eval
# But we don't trust their attributes and their underlying types
# They will be wrapped in a CheckerWrapper
_wrapped_instances = (
    Mock,
    MagicMock,
) + _wrapped_types

# Set of the modules that are allowed to be imported
# But we don't trust their attributes.
# So we wrap them in a CheckerWrapper
_ALLOWED_MODULES = frozenset({
    "datetime",
    "dateutil",
    "json",
    "pytz",
    "time",
    *[f"dateutil.{mod}" for mod in ['parser',
                                    'relativedelta', 'rrule', 'tz']],
})

class CodeChecker(ast.NodeTransformer):
    """Runs a static analysis on the code by using the abstract syntax tree (AST) of the code.
    If it's not possible to statically check the code, it will pass the object to an other checks that will be done at runtime.

    The possible exceptions that can be raised are:
        - :exc:`SyntaxError`: if the code contains a forbidden node.
        - :exc:`NameError`: if the code contains a forbidden name.

    :param sandboxed_types: additional types that are allowed in the code.
    :param expr: indicates if the code is a mathematical expression or not.
    """

    def __init__(self, sandboxed_instances=(), sandboxed_types=(), subset=_ALLOWED_NODES):
        self.__subset = subset
        self.allow_instance = sandboxed_instances
        self.allow_type = sandboxed_types
        self.nodes = None


    def visit(self, node):
        """ Checks if a node is either allowed from the whitelist or if a check is written in the class.
        If the node is not allowed, it raises a :exc:`SyntaxError`.
        If the node is allowed, it calls the corresponding visit method and applies the appropriate checks.

        :param node: is the node to visit.
        :return: the node after the checks.
        """

        if self.nodes is None:
            self.nodes = node

        visitor = getattr(
            self, f'explore_{node.__class__.__name__}', self.generic_visit)

        is_safe_node = visitor != self.generic_visit or isinstance(node, tuple(self.__subset)) # pylint: disable=comparison-with-callable (Reason: we want to compare the visitor function with the generic_visit function)

        if not is_safe_node:
            raise SyntaxError(
                f"Nodes of type {node.__class__.__name__} are not allowed"
            )

        if (hasattr(node, 'targets') or hasattr(node, 'target')) and visitor == self.generic_visit: # pylint: disable=comparison-with-callable
            raise SyntaxError(f"Shouldn't happen, the targets are {getattr(node, 'targets', getattr(node, 'target', None))}")

        return visitor(node)

    def explore_arg(self, node):
        """
        Explores every arguments on a function definition.
        And checks that it doesn't contain dunders.

        Example of forbidden uses of arg:
            - def foo(__x): ...
        """
        node = self.generic_visit(node)

        if "__" in node.arg:
            raise NameError(f"Forbidden name '{node.arg}'.")

        return node

    def explore_FunctionDef(self, node):
        """
        Explores every function definitions.
        And checks that the function name doesn't contain dunders.

        Example of forbidden uses of function definitions:
            - def __foo(): ...
        """

        node = self.generic_visit(node)

        if "__" in node.name:
            raise NameError(f"Forbidden name '{node.name}'.")

        return node

    def explore_Assign(self, node):
        """
        self.expr = expr
        Explores every assignations
        And checks that the target is either:
            - a name (x = 1)
            - a subscript (x[0] = 1)
            - a tuple (x, y = 1, 2)
        """

        node = self.generic_visit(node)
        if any(isinstance(target, (ast.Name, ast.Subscript, ast.Tuple)) for target in node.targets):
            return node
        else:
            raise TypeError(
                f"Forbidden assignation to {node.targets}"
            )

    def explore_AugAssign(self, node):
        """
        self.expr += expr

        Explores every augmented assignations
        And checks that the target is either:
            - a name (x += 1)
            - a subscript (x[0] += 1)
        """

        node = self.generic_visit(node)

        if isinstance(node.target, (ast.Name, ast.Subscript)):
            return node
        else:
            raise TypeError(
                f"Forbidden assignation to {node.target}"
            )

    def explore_For(self, node):
        node = self.generic_visit(node)

        if isinstance(node.target, (ast.Name, ast.Subscript, ast.Tuple)):
            return node
        else:
            raise TypeError(
                f"Forbidden assignation to {node.target}."
            )

    def explore_comprehension(self, node):
        node = self.generic_visit(node)

        if isinstance(node.target, (ast.Name, ast.Subscript, ast.Tuple)):
            return node
        else:
            raise TypeError(
                f"Forbidden assignation to {node.target}."
            )

    def explore_Call(self, node):
        """
        Explores every calls.
        Wraps the call to the __call_checker function.
        We do this to check the type of the arguments and the return value of the function at runtime.
        """
        node = self.generic_visit(node)

        return ast.Call(
            func=ast.Name("__call_checker", ctx=ast.Load()),
            args=[node.func] + node.args,
            keywords=node.keywords,
        )

    def explore_keyword(self, node):
        """
        Explores every keywords on a function call or definition.
        And checks that it doesn't contain dunders.

        Example of forbidden uses of keyword:
            - foo(__x = 1)
            - def foo(__x = 1): ...
        """
        node = self.generic_visit(node)

        if node.arg and "__" in node.arg:
            raise NameError(f"Forbidden name '{node.arg}'.")

        return node

    def explore_Name(self, node):
        """
        Explores every names.
        And checks that it doesn't contain dunders.
        """
        node = self.generic_visit(node)

        if "__" in node.id:
            raise NameError(f"Forbidden name '{node.id}'.")

        return node

    def explore_Subscript(self, node):
        """
        Explores every subscripts.
        Wraps the subscript to the __CheckerWrapper function, to check the type of the subscripted object.
        We do this because we can't check the type of the subscripted object at compile time.
        """
        node = self.generic_visit(node)

        return ast.Subscript(
            value=ast.Call(
                func=ast.Name("__CheckerWrapper"),
                args=[node.value, ast.Name(id="__type_checker")],
                keywords=[]),
            slice=node.slice,
            ctx=node.ctx
        )

    def explore_Constant(self, node):
        return super().visit_Constant(node)

    def explore_Attribute(self, node):
        """
        Explores every attributes.
        Wraps the node inside of the __CheckerWrapper function, to check the type of the object dynamically.
        """
        node = self.generic_visit(node)

        return ast.Attribute(
            value=ast.Call(
                func=ast.Name("__CheckerWrapper", ctx=ast.Load()),
                args=[node.value, ast.Name(id="__type_checker")],
                keywords=[]),
            attr=node.attr,
            ctx=ast.Load())

    def get_environment(self):
        """
        :return: the environment of the sandbox
        """

        __allowed_types = tuple(_ALLOWED_TYPES) + self.allow_type
        __allowed_instances = tuple(_ALLOWED_INSTANCES) + self.allow_instance + self.allow_type

        def type_checker(obj):
            """Checks if the object is safe to be used in eval.
            If it's not, it raises a :exc:`TypeError`.

            :param obj: The object to check.

            :return: The object if it is safe to be used in eval.
            """
            if callable(obj) and (obj is safe_eval or obj is eval or obj is exec): # pylint: disable=comparison-with-callable
                raise TypeError("You cannot pass the safe_eval function to any objects")

            if isinstance(obj, __allowed_instances) or (type(obj) is type and obj in __allowed_types): # pylint: disable=unidiomatic-typecheck
                return obj
            elif isinstance(obj, _wrapped_instances) or (type(obj) is type and obj in _wrapped_types) or (type(obj) is types.ModuleType and obj.__name__ in _ALLOWED_MODULES): # noqa: E721 (Reason: `type(...) is ...` is stricter than `isinstance(..., ...)` in this case) # pylint: disable=unidiomatic-typecheck
                return CheckerWrapper(obj, type_checker)
            else:
                raise TypeError(
                    f"Object {obj} of type '{type(obj)}' is not allowed."
                )

        def call_checker(func, *args, **kwargs):
            if func in [safe_eval, exec, eval]: # pylint: disable=comparison-with-callable
                raise TypeError("You cannot pass the safe_eval function to any objects")

            for arg in (*args, *kwargs.values()):
                type_checker(arg)

            if type(func) in _CALLABLE_TYPES:
                return type_checker(func(*args, **kwargs))
            elif func in __allowed_types or type(func) in __allowed_instances:
                return func(*args, **kwargs)
            else:
                raise SyntaxError(
                    f"Function '{func}' is not allowed to be called.\n"
                )


        return {
            "__call_checker": call_checker,
            "__type_checker": type_checker,
            "__CheckerWrapper": CheckerWrapper,
        }

__SAFE_EVAL_CHECKER = CodeChecker()
__DEFAULT_ENV = __SAFE_EVAL_CHECKER.get_environment()
_BUILTIN_MODULES = {
    m: CheckerWrapper(__import__(m), __DEFAULT_ENV['__type_checker']) for m in _ALLOWED_MODULES
}


def const_eval(expr):
    """const_eval(expression) -> value

    Safe Python constant evaluation

    Evaluates a string that contains an expression describing
    a Python constant. Strings that are not valid Python expressions
    or that contain other code besides the constant raise ValueError.

    >>> const_eval("10")
    10
    >>> const_eval("[1,2, (3,4), {'foo':'bar'}]")
    [1, 2, (3, 4), {'foo': 'bar'}]
    >>> const_eval("1+2")
    Traceback (most recent call last):
    ...
    """
    return ast.literal_eval(expr)


def expr_eval(expr):
    """expr_eval(expression) -> value
    Restricted Python expression evaluation
    Evaluates a string that contains an expression that only
    uses Python constants. This can be used to e.g. evaluate
    a numerical expression from an untrusted source.
    >>> expr_eval("1+2")
    3
    >>> expr_eval("[1,2]*2")
    [1, 2, 1, 2]
    >>> expr_eval("__import__('sys').modules")
    Traceback (most recent call last):
    ...
    SyntaxError: Nodes of type Name are not allowed
    """
    code = ast.unparse(CodeChecker(subset=_MATH_NODES).visit(ast.parse(expr)))
    return unsafe_eval(code)


def allow_type(t):
    """
    Class decorator that adds the class to the list of allowed types
    """
    global _wrapped_types   # noqa: PLW0603 (Reason: we need to modify the global variable, check docstring) # pylint: disable=global-statement
    global _wrapped_instances # noqa: PLW0603 (Reason: we need to modify the global variable, check docstring) # pylint: disable=global-statement

    _wrapped_types += (t,)
    _wrapped_instances += (t,)
    return t


def allow_instance(t):
    """
    Class decorator that adds the class to the list of allowed instances
    """
    global _wrapped_instances # noqa: PLW0603 (Reason: we need to modify the global variable, check docstring) # pylint: disable=global-statement

    _wrapped_instances += (t,)
    return t


def check_keys(d, reserved_keys):
    """
    Checks if no reserved keys are used in a dictionary

    :param d: The dictionary to check
    :param reserved_keys: The reserved keys

    :raises NameError: If a reserved key is used

    :return: The dictionary if no reserved keys are used
    """
    if not d:
        return d

    new_dict = d.copy()

    for k in d:
        if k in reserved_keys:
            del new_dict[k]

    d = new_dict

def safe_eval(expr, globals_dict=None, locals_dict=None, mode="eval",
        nocopy=False, locals_builtins=False, filename=None, sandboxed_instances=(), sandboxed_types=(), ast_subset=_ALLOWED_NODES):
    """safe_eval(expression[, globals[, locals[, mode[, nocopy]]]]) -> result

    System-restricted Python expression evaluation

    Evaluates a string that contains an expression that mostly
    uses Python constants, arithmetic expressions and the
    objects directly provided in context.

    This can be used to e.g. evaluate
    an OpenERP domain expression from an untrusted source.

    :param expr: the expression to evaluate

    :param globals_dict: a dictionary of global variables to use

    :param locals_dict: a dictionary of local variables to use

    :param mode: the mode in which to evaluate the expression
                            (see the built-in function eval() for details)

    :param nocopy: if False, the globals and locals dictionaries are
                            copied before being passed to eval() to prevent
                            alteration of the local/globals

    :param locals_builtins: if True, the builtins are added to the locals

    :param filename: optional pseudo-filename for the compiled expression,
                            displayed for example in traceback frames

    :param sandboxed_instance: A tuple of types that are allowed to be used as
                        instances in the expression.

    :param sandboxed_type: A tuple of types that are allowed to be used as types
                     and as instances in the expression.

    :param wrapped: If True, this means that the expression is already wrapped

    :throws TypeError: If the expression provided is a code object
    :throws SyntaxError: If the expression provided is not valid Python
    :throws NameError: If the expression provided accesses forbidden names
    :throws ValueError: If the expression provided uses forbidden bytecode
    """

    if type(expr) is types.CodeType: # noqa: E721 (Reason: legacy code) # pylint: disable=unidiomatic-typecheck
        raise TypeError(
            "safe_eval does not allow direct evaluation of code objects."
        )

    for node in ast_subset:
        if node not in _ALLOWED_NODES:
            raise ValueError(
                f"Node {node} is not allowed in the subset of nodes."
            )

    # prevent altering the globals/locals from within the sandbox
    # by taking a copy.
    if not nocopy:
        # isinstance() does not work below, we want *exactly* the dict class
        if (globals_dict is not None and type(globals_dict) is not dict) \
                or (locals_dict is not None and type(locals_dict) is not dict):
            _logger.warning(
                "Looks like you are trying to pass a dynamic environment, "
                "you should probably pass nocopy=True to safe_eval().")
        if globals_dict is not None:
            globals_dict = dict(globals_dict)
        if locals_dict is not None:
            locals_dict = dict(locals_dict)

    code_checker = CodeChecker(sandboxed_instances, sandboxed_types, ast_subset)
    safe_env = code_checker.get_environment()

    check_keys(locals_dict, safe_env.keys())
    check_keys(globals_dict, safe_env.keys())

    if globals_dict is None:
        globals_dict = {}

    globals_dict['__builtins__'] = _BUILTINS

    if locals_builtins:
        if locals_dict is None:
            locals_dict = {}

        locals_dict.update(_BUILTINS)

    if type(expr) is bytes: # noqa: E721 (Reason: legacy code) # pylint: disable=unidiomatic-typecheck
        expr = expr.decode('utf-8')

    code = code_checker.visit(ast.parse(expr.strip(), filename=filename or ""))
    c = ast.unparse(code)

    globals_dict.update(safe_env)

    try:
        return unsafe_eval(compile(c, filename or "<sandbox>", mode),
                           globals_dict, locals_dict)
    except odoo.exceptions.UserError:
        raise
    except odoo.exceptions.RedirectWarning:
        raise
    except werkzeug.exceptions.HTTPException:
        raise
    except OperationalError:
        # Do not hide PostgreSQL low-level exceptions, to let the auto-replay
        # of serialized transactions work its magic
        raise
    except ZeroDivisionError:
        raise
    except Exception as e:
        raise ValueError(f"{type(e)} : {e} while evaluating\n{expr}")


def test_python_expr(expr: str, mode: str = "eval"):
    try:
        wrapped_expr = ast.unparse(CodeChecker().visit(ast.parse(expr)))
        compile(wrapped_expr, "<sandbox>", mode)
    except (TypeError, NameError, SyntaxError, ValueError) as err:
        if len(err.args) >= 2 and len(err.args[1]) >= 4:
            error = {
                'message': err.args[0],
                'filename': err.args[1][0],
                'lineno': err.args[1][1],
                'offset': err.args[1][2],
                'error_line': err.args[1][3],
            }

            msg = f"{type(err).__name__} : {error['message']} at line {error['lineno']}\n{error['error_line']}"
        else:
            msg = f"{err}"

        return msg

    return False

json = _BUILTIN_MODULES['json']
time = _BUILTIN_MODULES['time']
pytz = _BUILTIN_MODULES['pytz']
dateutil = _BUILTIN_MODULES['dateutil']
datetime = _BUILTIN_MODULES['datetime']
