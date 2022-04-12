#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import ast
import types
from inspect import cleandoc, getsource

__require_checks_type = (
    types.FunctionType,
    types.LambdaType,
    types.MethodType,
    types.BuiltinFunctionType,
    types.BuiltinMethodType,
    types.WrapperDescriptorType,
    types.MethodWrapperType,
    types.MethodDescriptorType,
    types.ClassMethodDescriptorType,
    types.ModuleType,
)

__safe_type = (
    str,
    bytes,
    float,
    complex,
    int,
    bool,
    type(None),
    tuple,
    list,
    set,
    dict,
    range,
    types.GeneratorType,
)


class NodeChecker(ast.NodeTransformer):
    def __init__(self, allow_function_calls, allow_private):
        self.allow_function_calls = allow_function_calls
        self.allow_private = allow_private
        self.reserved_name = (
            "__ast_check_fn",
            "__ast_check_type_fn",
            "__ast_check_attr_and_type",
        )
        super().__init__()

    def visit_Call(self, node):
        node = self.generic_visit(node)

        if not self.allow_function_calls:
            raise Exception("safe_eval didn't permit you to call any functions")

        return ast.Call(
            func=ast.Name("__ast_check_fn", ctx=ast.Load()),
            args=[node.func, ast.Name("__ast_check_type_fn", ctx=ast.Load())]
            + node.args,
            keywords=node.keywords,
        )

    def visit_Name(self, node):
        node = self.generic_visit(node)

        if node.id in self.reserved_name:
            raise NameError(f"safe_eval: {node.id} is a reserved name")

        return node

    def visit_FunctionDef(self, node):
        node = self.generic_visit(node)

        if node.name in self.reserved_name:
            raise NameError(f"safe_eval: {node.name} is a reserved name")

        return node

    def visit_Attribute(self, node):
        node = self.generic_visit(node)

        if (
            isinstance(node.value, ast.Name)
            and node.value.id.startswith("_")
            and not self.priv
        ):
            raise NameError(f"safe_eval: didn't permit you to read private elements")

        if isinstance(node.ctx, ast.Load):
            return ast.Call(
                func=ast.Name("__ast_check_attr_and_type", ctx=ast.Load()),
                args=[node.value, ast.Constant(node.attr), node],
                keywords=[],
            )

        elif isinstance(node.ctx, ast.Store):
            raise ValueError(
                "safe_eval: doesn't permit you to store values in attributes"
            )

        elif isinstance(node.ctx, ast.Del):
            raise ValueError("safe_eval: doesn't permit you to delete attributes")


def is_unbound_method_call(func):
    """
    is_unbound_method_call(func) -> bool

    Checks that a function is an unbound method or not. Unlike bound method, it's complicated to determine
    if it's a function or a method. The only way we found was to check for the qualname (we intend class.method).
    The class and the method has to be a valid Python identifier and should have only one dot.

    :param func: A function type object
    :return bool: Is an unbound method or not
    """
    try:
        classname, methodname = func.__qualname__.split(".")
    except ValueError:
        # Probably a namespace (like TestFuncChecker.test_function_call.abc)
        return False

    if not classname.isidentifier() or not methodname.isidentifier():
        return False  # Probably smth like <listcomp>.<lambda>

    if type(func) == types.BuiltinMethodType or type(func) == types.MethodType:
        return False  # A bound method

    return True


def expr_checker_prepare_context(
    get_attr, return_code=False, check_type=None, check_function=None
):
    def __ast_default_check_call(func, check_type, *args, **kwargs):
        if func is None:
            return None

        if check_function is not None and check_function(
            func, check_type, *args, **kwargs
        ):
            return check_type("returned", func(*args, **kwargs))

        if (
            func.__name__ == "get"
            and hasattr(func, "__self__")
            and type(func.__self__) == dict
        ):
            # If it's a dictionnary, we check types like it's a constant
            return check_type("constant", func(*args, **kwargs))

        for arg in (*args, *kwargs.values()):
            check_type("arguments", arg)

            if "." in func.__qualname__:
                if (
                    args
                    and (
                        is_unbound_method_call(func)
                        and not hasattr(args[0], func.__name__)
                    )
                    or (
                        hasattr(args[0], func.__name__)
                        and getattr(args[0], func.__name__).__func__ != func
                    )
                ):
                    raise ValueError(
                        "safe_eval didn't like method call without appropriate type"
                    )

        if hasattr(func, "__self__"):
            check_type("called", func.__self__)

        return check_type("returned", func(*args, **kwargs))

    def __ast_default_check_type(method, value):
        """
        __ast_default_check_type(method, value) -> value

        check the type of `value` against a whitelist and return the value.
        will the check if the plug-in function `check_type` (argument from the `prepare_context` function) is present or not.

        The plug-in function will take the same arguments as this function and should return a boolean (True if allowed and False otherwise)

        :param method: A string that represent the way the value interact with code this can be:
                        * returned: if it's returned from a function (eg: return value)
                        * arguments: if it's a function argument (eg: foo(value))
                        * constant: if it's a constant (eg: value)
                        * called: if it's a function call, it can be useful in case of bound method (with the __self__ attribute) (eg: value()).

        :param value: A value that needs to be checked.
        :return: The value passed to this function.
        """
        if check_type is not None and check_type(method, value):
            return value

        if (
            type(value) not in __safe_type + __require_checks_type
            or type(value) in __require_checks_type
            and method in ["returned", "arguments"]
        ):
            raise ValueError(f"safe_eval didn't like {value} (type: {type(value)})")

        return value

    def __ast_check_attr_and_type(value, attr, node):
        return __ast_default_check_type("attribute", get_attr(value, attr, node))

    if not return_code:
        return {
            "__ast_check_type_fn": __ast_default_check_type,
            "__ast_check_fn": __ast_default_check_call,
            "__ast_check_attr_and_type": __ast_check_attr_and_type,
        }

    else:
        return "\n".join(
            [
                cleandoc(
                    getsource(get_attr).replace(get_attr.__name__, "__ast_check_attr")
                ),
                cleandoc(
                    getsource(check_type).replace(
                        check_type.__name__, "__ast_check_type_fn"
                    )
                ),
                cleandoc(
                    getsource(check_function).replace(
                        check_function.__name__, "__ast_check_fn"
                    )
                ),
                user_code,
            ]
        )


def expr_checker(
    expr,
    allow_function_calls=True,
    allow_private=False,
    return_code=True,
):
    node_checker = NodeChecker(allow_function_calls, allow_private)
    return ast.unparse(node_checker.visit(ast.parse(expr)))
