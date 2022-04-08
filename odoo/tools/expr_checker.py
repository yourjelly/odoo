#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import ast
import types
from inspect import cleandoc, getsource


def __ast_default_check_type(method, value):
    require_checks_type = (
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

    safe_type = (
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

    if (
        type(value) not in safe_type + require_checks_type
        or type(value) in require_checks_type
        and method in ["returned", "arguments"]
    ):
        raise ValueError(f"safe_eval didn't like {value}")

    return value


def is_unbound_method_call(func):
    try:
        classname, methodname = func.__qualname__.split(".")
    except ValueError:
        return (
            False  # Probably a namespace (like TestFuncChecker.test_function_call.abc)
        )

    if not classname.isidentifier() or not methodname.isidentifier():
        return False  # Probably smth like <listcomp>.<lambda>

    if type(func) == types.BuiltinMethodType:
        return False

    return type(func) != types.MethodType


def __ast_default_check_call(func, check_type, *args, **kwargs):
    if (
        func.__name__ == "get"
        and hasattr(func, "__self__")
        and type(func.__self__) == dict
    ):
        return func(*args, **kwargs)

    for arg in (*args, *kwargs.values()):
        check_type("arguments", arg)

        if "." in func.__qualname__:
            if args and (is_unbound_method_call(func) and not hasattr(args[0], func.__name__)):
                raise ValueError(
                    "safe_eval didn't like method call without appropriate type"
                )

    if hasattr(func, "__self__"):
        check_type("called", func.__self__)

    return check_type("returned", func(*args, **kwargs))


class NodeChecker(ast.NodeTransformer):
    def __init__(self, allow_function_calls, allow_private):
        self.fncall = allow_function_calls
        self.priv = allow_private
        self.reserved_name = [
            "__ast_check_fn",
            "__ast_check_type_fn",
            "__ast_check_attr",
        ]
        super().__init__()

    def visit_Call(self, node):
        node = self.generic_visit(node)

        if not self.fncall:
            raise Exception("safe_eval didn't permit you to call any functions")

        return ast.Call(
            func=ast.Name("__ast_check_fn", ctx=ast.Load()),
            args=[node.func, ast.Name("__ast_check_type_fn", ctx=ast.Load())]
            + node.args,
            keywords=node.keywords,
        )

    def visit_Name(self, node):
        node = self.generic_visit(node)

        if node.id.startswith("_") and not self.priv:
            raise NameError(f"safe_eval: didn't permit you to read private elements")

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

        if isinstance(node.ctx, ast.Load):
            subcall = ast.Call(
                func=ast.Name("__ast_check_attr", ctx=ast.Load()),
                args=[node.value, ast.Constant(node.attr), node],
                keywords=[],
            )

            return ast.Call(
                func=ast.Name("__ast_check_type_fn", ctx=ast.Load()),
                args=[ast.Constant("attribute"), subcall],
                keywords=[],
            )

        elif isinstance(node.ctx, ast.Store):
            raise ValueError(
                "safe_eval: doesn't permit you to store values in attributes"
            )

        elif isinstance(node.ctx, ast.Del):
            raise ValueError("safe_eval: doesn't permit you to delete attributes")


def expr_checker(
    expr,
    get_attr,
    allow_function_calls=True,
    allow_private=False,
    check_type=__ast_default_check_type,
    check_function=__ast_default_check_call,
    return_code=True,
):
    node_checker = NodeChecker(allow_function_calls, allow_private)
    user_code = ast.unparse(node_checker.visit(ast.parse(expr)))

    if return_code:
        code = "\n".join(
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

    else:
        code = user_code

    return (
        code,
        {
            "__ast_check_type_fn": check_type,
            "__ast_check_fn": check_function,
            "__ast_check_attr": get_attr,
        },
    )
