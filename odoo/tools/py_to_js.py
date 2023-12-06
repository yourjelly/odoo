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
        self._globals = {}
        self._attribute_map = {}

    def add_to_globals(self, to_map, target):
        self._globals[to_map] = target

    def register_type(self, target, value_class):
        self._attribute_map.setdefault(value_class, set())
        self._attribute_map[value_class].add(target)

    def map_global(self, target):
        return self._globals.get(target, target)

    def get_variable_class(self, var):
        return self._attribute_map.get(var)


# -------------------------------------------------------------------------
# CONVERTER: STMT
# -------------------------------------------------------------------------


def convert_ast_stmt_function_def(node, options, scope):
    function_def_str = f"function {node.name}({convert(node.args, options, scope)})"
    body_str = "".join(convert(body, options, scope) for body in node.body)
    return f"{function_def_str}{{{body_str}}}"


def convert_ast_stmt_return(node, options, scope):
    return f"return {convert(node.value, options, scope)};"


def convert_ast_stmt_assign(node, options, scope):
    targets_str_list = [convert(target, options, scope) for target in node.targets]
    value_str = convert(node.value, options, scope)
    if isinstance(node.value, ast.Constant):
        value_str = f"\"{value_str}\""
    if isinstance(node.targets[0], ast.Name):
        head_str = 'let '
    else:
        head_str = ''
    for target, target_str in zip(node.targets, targets_str_list):
        if isinstance(node.value, (ast.Tuple, ast.List, ast.Dict)):
            scope[target_str] = node.value.__class__
        elif isinstance(target, ast.Subscript):
            target_value_str = convert(target.value, options, scope)
            target_class = scope.get(target_value_str)
            if target_class:
                scope[target_str] = node.value.__class__
    return f"{head_str}{' = '.join(targets_str_list)} = {value_str};"


def convert_ast_stmt_aug_assign(node, options, scope):
    op_str = convert(node.op, options, scope)
    target_str = convert(node.target, options, scope)
    value_str = convert(node.value, options, scope)
    return f"{target_str} {op_str}= {value_str}"


def convert_ast_stmt_for(node, options, scope):
    iter_str = convert(node.iter, options, scope)
    target_str = convert(node.target, options, scope)
    body_str = "".join(convert(body, options, scope) for body in node.body)
    return f"for(const {target_str} of {iter_str}){{{body_str}}}"


def convert_ast_stmt_while(node, options, scope):
    test_str = convert(node.test, options, scope)
    while_str = f"while({test_str})"
    body_str = "".join(convert(body, options, scope) for body in node.body)
    return f"{while_str}{{{body_str}}}"


def convert_ast_stmt_if(node, options, scope):
    compare_str = convert(node.test, options, scope)
    if_str = f"if({compare_str})"
    body_str = "".join(convert(body, options, dict(scope)) for body in node.body)
    orelse_str_list = []
    for orelse in node.orelse:
        orelse_str = convert(orelse, options, scope)
        if not isinstance(orelse, ast.If):
            orelse_str = f'{{{orelse_str}}}'
        orelse_str_list.append(f" else {orelse_str}")
    return f"{if_str}{{{body_str}}}{''.join(orelse_str_list)}"


def convert_ast_stmt_expr(node, options, scope):
    return f"{convert(node.value, options, scope)};"


# -------------------------------------------------------------------------
# CONVERTER: EXPR
# -------------------------------------------------------------------------


def convert_ast_expr_bool_op(node, options, scope):
    return f" {convert(node.op, options, scope)} ".join(convert(boolop, options, scope) for boolop in node.values)


def convert_ast_expr_bin_op(node, options, scope):
    left_str = convert(node.left, options, scope)
    op_str = convert(node.op, options, scope)
    right_str = convert(node.right, options, scope)
    return f"{left_str} {op_str} {right_str}"


def convert_ast_expr_lambda(node, options, scope):
    args = convert(node.args, options, scope)
    return f"({args}) => {convert(node.body, options, scope)}"


def convert_ast_expr_dict(node, options, scope):
    items = []
    for key, value in zip(node.keys, node.values):
        value_str = convert(value, options, scope)
        if isinstance(value, ast.Constant):
            value_str = f"\"{value_str}\""
        if key is None:
            # '**values,' in the dictionary produce a None key.
            items.append(f"...{value_str}")
        else:
            key_str = convert(key, options, scope)
            items.append(f"{key_str}: {value_str}")
    return f"{{{', '.join(items)}}}"


def convert_ast_expr_list_comp(node, options, scope):
    generator = node.generators[0]
    generator_target_str = convert(generator.target, options, scope)
    generator_str = convert(generator, options, scope)
    elt_str = f".map(({generator_target_str}) => {convert(node.elt, options, scope)})"
    return f"{generator_str}{elt_str}"


def convert_ast_expr_generator_exp(node, options, scope):
    elt_str = convert(node.elt, options, scope)
    generator_str = convert(node.generators[0], options, scope)
    target_str = convert(node.generators[0].target, options, scope)
    if target_str == elt_str:
        tail_str = ""
    else:
        tail_str = f".map(({target_str}) => {elt_str})"
    return f"{generator_str}{tail_str}"


def convert_ast_expr_compare(node, options, scope):
    comparator_str = convert(node.comparators[0], options, scope)
    op = node.ops[0]
    op_str = convert(op, options, scope)
    left_str = convert(node.left, options, scope)
    if isinstance(op, ast.In) or isinstance(op, ast.NotIn):
        return op_str % (comparator_str, left_str)
    else:
        return f"{left_str} {op_str} {comparator_str}"


def convert_ast_expr_call(node, options, scope):
    args = ", ".join(convert(arg_node, options, scope) for arg_node in node.args)

    # Special case for dict.update
    if isinstance(node.func, ast.Attribute):
        func_value_str = convert(node.func.value, options, scope)
        func_value_class = scope.get(func_value_str)
        func_attr = node.func.attr
        if func_value_class == ast.Dict:
            if func_attr == 'update':
                return f"Object.assign({func_value_str}, {args})"

    function_name = convert(node.func, options, scope)
    if function_name == 'max':
        function_name = 'Math.max'
    elif function_name == 'min':
        function_name = 'Math.min'
    elif function_name == 'sum':
        return f"{args}.reduce(function (a, b) {{ return a + b; }}, 0)"
    elif function_name == "range":
        return f"[...Array({args}).keys()]"
    return f"{function_name}({args})"


def convert_ast_expr_constant(node, options, scope):
    return str(node.value)


def convert_ast_expr_attribute(node, options, scope):
    value_str = convert(node.value, options, scope)
    attr = node.attr
    value_class = scope.get(value_str)
    if value_class == ast.List:
        if attr == 'append':
            attr = 'push'
    return f"{value_str}.{attr}"


def convert_ast_expr_subscript(node, options, scope):
    value_str = convert(node.value, options, scope)
    slice_str = convert(node.slice, options, scope)
    return f"{value_str}.{slice_str}"


def convert_ast_expr_name(node, options, scope):
    return node.id


def convert_ast_expr_list(node, options, scope):
    return f"[{', '.join(convert(el, options, scope) for el in node.elts)}]"


def convert_ast_expr_tuple(node, options, scope):
    return convert_ast_expr_list(node, options, scope)


# -------------------------------------------------------------------------
# CONVERTER: BOOLOP
# -------------------------------------------------------------------------


def convert_ast_boolop_and(node, options, scope):
    return "&&"


def convert_ast_boolop_or(node, options, scope):
    return "||"


# -------------------------------------------------------------------------
# CONVERTER: OPERATOR
# -------------------------------------------------------------------------


def convert_ast_operator_add(node, options, scope):
    return "+"


def convert_ast_operator_sub(node, options, scope):
    return "-"


def convert_ast_operator_mult(node, options, scope):
    return "*"


def convert_ast_operator_div(node, options, scope):
    return "/"


def convert_ast_operator_mod(node, options, scope):
    return "%"


def convert_ast_operator_pow(node, options, scope):
    return "^"


# -------------------------------------------------------------------------
# CONVERTER: CMPOP
# -------------------------------------------------------------------------


def convert_ast_cmpop_eq(node, options, scope):
    return "==="


def convert_ast_cmpop_not_eq(node, options, scope):
    return "!=="


def convert_ast_cmpop_lt(node, options, scope):
    return "<"


def convert_ast_cmpop_lt_e(node, options, scope):
    return "<="


def convert_ast_cmpop_gt(node, options, scope):
    return ">"


def convert_ast_cmpop_gt_e(node, options, scope):
    return ">="


def convert_ast_cmpop_is(node, options, scope):
    return convert_ast_cmpop_eq(node, options, scope)


def convert_ast_cmpop_is_not(node, options, scope):
    return convert_ast_cmpop_not_eq(node, options, scope)


def convert_ast_cmpop_in(node, options, scope):
    return "%s.includes(%s)"


def convert_ast_cmpop_not_in(node, options, scope):
    return "!%s.includes(%s)"


# -------------------------------------------------------------------------
# CONVERTER: MISC
# -------------------------------------------------------------------------


def convert_ast_comprehension(node, options, scope):
    iter_str = convert(node.iter, options, scope)
    target_str = convert(node.target, options, scope)
    ifs_str = f".filter(({target_str}) => ({convert(node.ifs[0], options, scope)}))" if node.ifs else ''
    return f"{iter_str}{ifs_str}"


def convert_ast_arguments(node, options, scope):
    return ", ".join(convert(arg_node, options, scope) for arg_node in node.args)


def convert_ast_arg(node, options, scope):
    return node.arg


NODE_MAPPING = {
    # stmt
    ast.FunctionDef: convert_ast_stmt_function_def,
    ast.Return: convert_ast_stmt_return,
    ast.Assign: convert_ast_stmt_assign,
    ast.AugAssign: convert_ast_stmt_aug_assign,
    ast.For: convert_ast_stmt_for,
    ast.While: convert_ast_stmt_while,
    ast.If: convert_ast_stmt_if,
    ast.Expr: convert_ast_stmt_expr,
    # expr
    ast.BoolOp: convert_ast_expr_bool_op,
    ast.BinOp: convert_ast_expr_bin_op,
    ast.Lambda: convert_ast_expr_lambda,
    ast.Dict: convert_ast_expr_dict,
    ast.ListComp: convert_ast_expr_list_comp,
    ast.GeneratorExp: convert_ast_expr_generator_exp,
    ast.Compare: convert_ast_expr_compare,
    ast.Call: convert_ast_expr_call,
    ast.Constant: convert_ast_expr_constant,
    ast.Attribute: convert_ast_expr_attribute,
    ast.Subscript: convert_ast_expr_subscript,
    ast.Name: convert_ast_expr_name,
    ast.List: convert_ast_expr_list,
    ast.Tuple: convert_ast_expr_tuple,
    # boolop
    ast.And: convert_ast_boolop_and,
    ast.Or: convert_ast_boolop_or,
    # operator
    ast.Add: convert_ast_operator_add,
    ast.Sub: convert_ast_operator_sub,
    ast.Mult: convert_ast_operator_mult,
    ast.Div: convert_ast_operator_div,
    ast.Mod: convert_ast_operator_mod,
    ast.Pow: convert_ast_operator_pow,
    # cmpop
    ast.Eq: convert_ast_cmpop_eq,
    ast.NotEq: convert_ast_cmpop_not_eq,
    ast.Lt: convert_ast_cmpop_lt,
    ast.LtE: convert_ast_cmpop_lt_e,
    ast.Gt: convert_ast_cmpop_gt,
    ast.GtE: convert_ast_cmpop_gt_e,
    ast.Is: convert_ast_cmpop_is,
    ast.IsNot: convert_ast_cmpop_is_not,
    ast.In: convert_ast_cmpop_in,
    ast.NotIn: convert_ast_cmpop_not_in,
    # misc
    ast.comprehension: convert_ast_comprehension,
    ast.arguments: convert_ast_arguments,
    ast.arg: convert_ast_arg,
}


def convert(node, options, scope):
    return NODE_MAPPING[node.__class__](node, options, scope)


def convert_to_js(node, options=None):
    options = options or Options()
    return convert(node, options, {})


# -------------------------------------------------------------------------
# TESTS
# -------------------------------------------------------------------------


if __name__ == "__main__":
    options = Options()

    def test1(aaa):
        bbb = aaa + 5
        return bbb

    print(test1_str := convert_to_js(convert_to_ast(test1), options=options))
    assert test1_str == "function test1(aaa){let bbb = aaa + 5;return bbb;}"

    def test2(nb):
        results = []
        i = 0
        while i < nb:
            results.append(i)
        return results

    print(test2_str := convert_to_js(convert_to_ast(test2), options=options))
    assert test2_str == "function test2(nb){let results = [];let i = 0;while(i < nb){results.push(i);}return results;}"

    def test3():
        return [i + 2 for i in range(10) if i % 2 == 0 and i not in (4, 6)]

    print(test3_str := convert_to_js(convert_to_ast(test3), options=options))
    assert test3_str == "function test3(){return [...Array(10).keys()].filter((i) => (i % 2 === 0 && ![4, 6].includes(i))).map((i) => i + 2);}"

    def test4():
        return {1: 'a', 2: 'b', 3: 'c'}

    print(test4_str := convert_to_js(convert_to_ast(test4), options=options))
    assert test4_str == """function test4(){return {1: "a", 2: "b", 3: "c"};}"""

    def test5(a):
        if a == 2:
            return a
        elif a == 4:
            return a + 2
        else:
            return a + 4

    print(test5_str := convert_to_js(convert_to_ast(test5), options=options))
    assert test5_str == "function test5(a){if(a === 2){return a;} else if(a === 4){return a + 2;} else {return a + 4;}}"

    def test6():
        for a, b in ((1, 2), (3, 4), (5, 6)):
            a + b

    print(test6_str := convert_to_js(convert_to_ast(test6), options=options))
    assert test6_str == "function test6(){for(const [a, b] of [[1, 2], [3, 4], [5, 6]]){a + b;}}"

    def test7(values):
        values.update({'a': 'a'})
        return {
            **(values or {}),
            'test': values['a'],
            'sum': sum(nb + 1 for nb in [1, 2, 3] if nb != 2),
        }

    print(test7_str := convert_to_js(convert_to_ast(test7), options=options))
    # assert test7_str == """function test7(values){return {...values || {}, test: values.a, sum: [1, 2, 3].filter((nb) => (nb !== 2)).map((nb) => nb + 1).reduce(function (a, b) { return a + b; }, 0)};}"""

    def test8():
        a = {'a': 'a'}
        if a:
            b = {'b': 'b'}
            b['c'] = c = 'c'
            a['b'] = b
            a.update({'c': c})

    print(test8_str := convert_to_js(convert_to_ast(test8), options=options))
