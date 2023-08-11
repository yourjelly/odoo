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


def _import(name, globals = None, locals = None, fromlist = None, level = - 1):
    if globals is None:
        globals = {}
    if locals is None:
        locals = {}
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

# List of the nodes that are allowed in mathemathical expressions
_MATH_NODES = (
    # Roots node, they are required in all cases
    ast.Expr,
    ast.Module,

    ast.Constant,

    ast.Add,
    ast.And,
    ast.BinOp,
    ast.BitAnd,
    ast.BitOr,
    ast.BitXor,
    ast.BoolOp,
    ast.Div,
    ast.Eq,
    ast.FloorDiv,
    ast.Gt,
    ast.GtE,
    ast.In,
    ast.Invert,
    ast.Is,
    ast.IsNot,
    ast.LShift,
    ast.Lt,
    ast.LtE,
    ast.Mod,
    ast.Mult,
    ast.Not,
    ast.NotEq,
    ast.NotIn,
    ast.Or,
    ast.Pow,
    ast.RShift,
    ast.Sub,
    ast.UAdd,
    ast.UnaryOp,
    ast.USub,
)

# List of the nodes that are allowed in all other expressions
# With addition of the math nodes
_ALLOWED_NODES = (
    # Ctx node
    ast.Load,

    # General keywords
    ast.Assign,
    ast.AugAssign,
    ast.Break,
    ast.Compare,
    ast.comprehension,
    ast.Continue,
    ast.Dict,
    ast.DictComp,
    ast.ExceptHandler,
    ast.For,
    ast.FormattedValue,
    ast.FunctionDef,
    ast.FunctionType,
    ast.GeneratorExp,
    ast.If,
    ast.IfExp,
    ast.JoinedStr,
    ast.Lambda,
    ast.List,
    ast.ListComp,
    ast.Pass,
    ast.Raise,
    ast.Set,
    ast.SetComp,
    ast.Slice,
    ast.Subscript,
    ast.Try,
    ast.Tuple,
    ast.While,

    ast.arg,
    ast.arguments
) + _MATH_NODES

_CALLABLE_TYPES = (
    types.BuiltinFunctionType,
    types.BuiltinMethodType,
    types.FunctionType,
    types.MethodType,
    types.MethodDescriptorType,
    types.LambdaType,
    types.GeneratorType,
    functools.partial,
    Mock,
    MagicMock,
)

_WRAPPED_TYPES = (
    Exception,
) + _CALLABLE_TYPES

_SAFE_MODULES = (
    "datetime",
    "dateutil",
    "json",
    "pytz",
    "time",
    *[f"dateutil.{mod}" for mod in ['parser',
                                    'relativedelta', 'rrule', 'tz']],
)

def check_format(s):
    """Wraps an object, if it's a string, raise an exception

    Raise a :exc:`SyntaxError` if the argument is a string.

    :param s: is the object to wrap.
    """

    if isinstance(s, str):
        raise SyntaxError("format method is forbidden on strings.")
    return s

class CheckerWrapper:
    """Wraps an object that can return / contain objects that can't be checked at compile time.
    Those objects are checked at runtime by hijacking dunder methods.

    Raises a :exc:`NameError` if the object is accessing a forbidden name.

    :param obj: is an object of any type that needs to be wrapped.
    :param type_checker: is the function used to check the type of the object.
                 The function has to follow the following signature: `type_checker(obj, is_wrapped=False)`.
                 You can refer to the :func:`__call_checker` function in this module for further documentation.
    """

    def __init__(self, obj, type_checker):
        self.__obj = type_checker(obj, is_wrapped=True)
        self.__type_checker = type_checker

    def __getitem__(self, item):
        self.__type_checker(item)
        return self.__type_checker(self.__obj.__getitem__(item))

    def __setitem__(self, key, value):
        self.__type_checker(key)
        self.__type_checker(value)

        self.__obj.__setitem__(key, value)

    def __call__(self, *args, **kwargs):
        for arg in (*args, *kwargs.values()):
            self.__type_checker(arg)

        return self.__type_checker(self.__obj(*args, **kwargs))

    def __getattr__(self, name):
        if "__" in name:
            raise NameError(f"Forbidden name '{name}'.")

        obj = super().__getattribute__("_CheckerWrapper__obj")
        return self.__type_checker(getattr(obj, name))


class CodeChecker:
    """Runs a static analysis on the code by using the abstract syntax tree (AST) of the code.
    If it's not possible to statically check the code, it will wrap it in a `CheckerWrapper` object.

    This class follows the semantic of the :class:`ast.NodeVisitor`
    For further information on all the visit methods, refer to :class:`ast.NodeVisitor`.

    The possible exceptions that can be raised are:
        - :exc:`SyntaxError`: if the code contains a forbidden node.
        - :exc:`NameError`: if the code contains a forbidden name.

    :param sandboxed_types: additional types that are allowed in the code.
    :param expr: indicates if the code is a mathematical expression or not.
    """

    def __init__(self, sandboxed_types = (),  subset = _ALLOWED_NODES):
        self.subset = subset
        self.sandboxed_types = sandboxed_types
        self.parent = None

    def visit(self, node):
        """ Checks if a node is either allowed from the whitelist or if a check is written in the class.
        If the node is not allowed, it raises a :exc:`SyntaxError`.
        If the node is allowed, it calls the corresponding visit method and applies the appropriate checks.

        :param node: is the node to visit.
        :return: the node after the checks.
        """

        node.parent = self.parent
        self.parent = node
        visitor = getattr(
            self, f'visit_{node.__class__.__name__}', self.generic_visit)

        is_safe_node = visitor != self.generic_visit or isinstance(node, self.subset)

        if not is_safe_node:
            raise SyntaxError(
                f"Nodes of type {node.__class__.__name__} are not allowed"
            )

        return visitor(node)

    def generic_visit(self, node):
        """Visits all the children node and route them to the main :meth:`visit` method.
        It also keeps track of the parent node of each node.

        :param node: is the node to visit.
        :return: the node itself after its children have been visited.
        """

        for field, old_value in ast.iter_fields(node):
            if isinstance(old_value, list):
                new_values = []
                for value in old_value:
                    if isinstance(value, ast.AST):
                        current_value = self.visit(value)
                        self.parent = node
                        if current_value is None:
                            continue
                        elif not isinstance(current_value, ast.AST):
                            new_values.extend(current_value)
                            continue
                    new_values.append(value)
                old_value[:] = new_values
            elif isinstance(old_value, ast.AST):
                new_node = self.visit(old_value)
                self.parent = node
                if new_node is None:
                    delattr(node, field)
                else:
                    setattr(node, field, new_node)
        return node

    def visit_Store(self, node):
        """ Verifies that the parent node of the Store node is allowed to be assigned to.
        Otherwise, it raises a :exc:`SyntaxError`.

        The only allowed parent nodes are:
            - :class:`ast.Name` (e.g. `a = 1`)
            - :class:`ast.Subscript` (e.g. `a[0] = 1`)
            - :class:`ast.Tuple` (e.g. `(a, b) = 1, 2`)
            - :class:`ast.List` (e.g. `[a, b] = [1, 2]`)

        :param node: is the node to visit.
        :return: the node itself.
        """

        if isinstance(node.parent, (ast.Name, ast.Subscript, ast.Tuple, ast.List)):
            return node
        else:
            raise TypeError(
                f"Forbidden assignation on {node.parent.__class__.__name__}"
            )

    def visit_Call(self, node):
        """Wrap the function and its arguments to :func:`__call_checker`
        to check if the function is safe to be called.

        :param node: is the node to visit.
        :return: A call node with the function and its arguments wrapped in :func:`__call_checker`.
        """
        node = self.generic_visit(node)

        return ast.Call(
            func=ast.Name("__call_checker", ctx=ast.Load()),
            args=[node.func] + node.args,
            keywords=node.keywords,
        )

    def visit_keyword(self, node):
        """Verify that the keyword is not a forbidden name.
        Otherwise it raises a :exc:`NameError`.

        :param node: is the node to visit.
        :return: the node itself.
        """

        node = self.generic_visit(node)

        if node.arg and "__" in node.arg:
            raise NameError(f"Forbidden name '{node.arg}'.")

        return node

    def visit_Name(self, node):
        """Verify that give name is not a forbidden.
        Otherwise it raises a :exc:`NameError`.

        :param node: is the node to visit.
        :return: the node itself.
        """

        node = self.generic_visit(node)

        if "__" in node.id:
            raise NameError(f"Forbidden name '{node.id}'.")

        return node

    def visit_Subscript(self, node):
        """ Wrap the subscripted value and its slice to :obj:`CheckerWrapper`
        to check if the subscripted value and its slice are safe to be used.

        :param node: is the node to visit.
        :return: A subscript node with the subscripted value and its slice wrapped in :obj:`CheckerWrapper`.
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

    def visit_Attribute(self, node):
        """ Wrap the attribute to :obj:`CheckerWrapper`
        to check if the attribute value is safe to be used and or called.

        :param node: is the node to visit.
        :return: The attribute node wrapped in :obj:`CheckerWrapper`.
        """

        node = self.generic_visit(node)

        if node.attr == 'format' or node.attr == 'format_map':
            if isinstance(node.value, ast.Str):
                raise TypeError("format method is not allowed on strings")
            else:
                node.value = ast.Call(func=ast.Name(id="__check_format", ctx=ast.Load()), args=[node.value], keywords=[])

        if "__" in node.attr:
            raise NameError(f"Forbidden name '{node.attr}'.")

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
        __SAFE_TYPES = (
            bool,
            bytes,
            complex,
            datetime.date,
            datetime.datetime,
            datetime.time,
            datetime.timedelta,
            dict,
            EmailMessage,
            enumerate,
            EnumMeta,
            FakeDateMeta,
            filter,
            float,
            int,
            JSON,
            list,
            map,
            odoo.api.Environment,
            odoo.exceptions.UserError,
            odoo.models.BaseModel,
            odoo.models.NewId,
            odoo.sql_db.Cursor,
            range,
            relativedelta,
            reversed,
            set,
            slice,
            str,
            tuple,
            type({}.items()),   # <class 'dict_items'>
            type({}.keys()),    # <class 'dict_keys'>
            type({}.values()),  # <class 'dict_values'>
            type(None),         # <class 'NoneType'>
            types.GeneratorType,
            zip,
        ) + self.sandboxed_types

        def type_checker(obj, allow_method=False, is_wrapped=False):
            """Checks if the object is safe to be used in eval.
            If it's not, it raises a :exc:`TypeError`.

            :param obj: The object to check.
            :param allow_method: If True, methods are allowed to be used without further checks.
            :param is_wrapped: If True, the object is wrapped in a CheckerWrapper.

            :return: The object if it is safe to be used in eval.
            """

            if (allow_method and type(obj) is types.MethodType) \
                    or isinstance(obj, __SAFE_TYPES) or obj in __SAFE_TYPES \
                    or type(obj) is CheckerWrapper \
                    or (is_wrapped and type(obj) is types.ModuleType and obj.__name__ in _SAFE_MODULES) \
                    or (is_wrapped and isinstance(obj, _WRAPPED_TYPES)) or (is_wrapped and obj in _WRAPPED_TYPES):
                return obj
            elif isinstance(obj, _WRAPPED_TYPES) or (type(obj) is types.ModuleType and obj.__name__ in _SAFE_MODULES):
                return CheckerWrapper(obj, type_checker)
            else:
                raise TypeError(
                    f"Object {obj} of type '{type(obj)}' is not allowed."
                )

        def call_checker(func, *args, **kwargs):
            """Checks if a function and its arguments are safe to be called.
            Otherwise it raises a :exc:`SyntaxError`.

            :param func: The function to check.
            :param args: The arguments to check.
            :param kwargs: The keyword arguments to check.

            :return: The result of the function call.
            """

            for arg in (*args, *kwargs.values()):
                type_checker(arg)

            if type(func) in _CALLABLE_TYPES:
                return type_checker(func(*args, **kwargs))
            elif func in __SAFE_TYPES or type(func) in __SAFE_TYPES or type(func) is CheckerWrapper:
                return func(*args, **kwargs)
            else:
                raise SyntaxError(
                    f"Function '{func}' is not allowed to be called.\n"
                )

        __WRAPPED_MODULE = {
            m: CheckerWrapper(__import__(m), type_checker) for m in _SAFE_MODULES
        }

        return {
            "__call_checker": call_checker,
            "__type_checker": type_checker,
            "__SAFE_TYPES": __SAFE_TYPES,
            "__CheckerWrapper": CheckerWrapper,
            "__check_format": check_format,
            **__WRAPPED_MODULE
        }


__SAFE_EVAL_CHECKER = CodeChecker()


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


def safe_type(type):
    global _WRAPPED_TYPES
    _WRAPPED_TYPES += (type, )
    return type

def check_keys(d, reserved_keys):
    if not d:
        return d

    for k in d:
        if k in reserved_keys and '__' in k:
            raise NameError(f"You cannot use '{k}' as a key in a context dictionary.")

    return d

def safe_eval(expr, globals_dict = None, locals_dict = None, mode = "eval",
        nocopy = False, locals_builtins = False, filename = None, sandboxed_types = (), ast_subset=_ALLOWED_NODES):
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

    :param sandboxed_types: a tuple of types that are allowed to be used
                            in the expression.

    :throws TypeError: If the expression provided is a code object
    :throws SyntaxError: If the expression provided is not valid Python
    :throws NameError: If the expression provided accesses forbidden names
    :throws ValueError: If the expression provided uses forbidden bytecode
    """

    if type(expr) is types.CodeType:
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

    safe_env = __SAFE_EVAL_CHECKER.get_environment()

    check_keys(locals_dict, safe_env.keys())
    check_keys(globals_dict, safe_env.keys())

    if globals_dict is None:
        globals_dict = {}

    globals_dict['__builtins__'] = _BUILTINS

    if locals_builtins:
        if locals_dict is None:
            locals_dict = {}

        locals_dict.update(_BUILTINS)

    if type(expr) is bytes:
        expr = expr.decode('utf-8')

    __SAFE_EVAL_CHECKER.sandboxed_types = sandboxed_types


    c = ast.unparse(__SAFE_EVAL_CHECKER.visit(
        ast.parse(expr.strip(), filename=filename or "")))
    globals_dict['__builtins__'].update(__SAFE_EVAL_CHECKER.get_environment())

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


json = __SAFE_EVAL_CHECKER.get_environment()['json']
time = __SAFE_EVAL_CHECKER.get_environment()['time']
pytz = __SAFE_EVAL_CHECKER.get_environment()['pytz']
dateutil = __SAFE_EVAL_CHECKER.get_environment()['dateutil']
datetime = __SAFE_EVAL_CHECKER.get_environment()['datetime']
