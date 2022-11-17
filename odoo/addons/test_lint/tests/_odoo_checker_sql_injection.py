import os
import astroid
from pylint import checkers, interfaces
from pylint.checkers import BaseChecker, utils

DFTL_CURSOR_EXPR = [
    'self.env.cr', 'self._cr',  # new api
    'self.cr',  # controllers and test
    'cr',  # old api
]

ATTRIBUTE_WHITELIST = [
    'get_sql', 'self.env.user.lang', 'get_lang().code', 'id', '_table'
]

FUNCTION_WHITELIST = [
    'create', 'read' , 'write','browse','select','get','strip','items', '_select', '_from'
]

func_call = {}
func_called_for_query = []

class OdooBaseChecker(BaseChecker):
    __implements__ = interfaces.IAstroidChecker
    name = 'odoo'

    msgs = {
        'E8501': (
            'Possible SQL injection risk.',
            'sql-injection',
            'See http://www.bobby-tables.com try using '
            'execute(query, tuple(params))',
        )
    }

    Failures = [] # TODO: use this list to show the variables that failed the test

    def _get_return_node(self,node):
        ret = []
        nodes = [node]
        while len(nodes) > 0:
            if isinstance(nodes[0], astroid.Return):
                ret.append(nodes[0])
                nodes = nodes[1:]
                continue
            else:
                nodes = nodes[1:] + list(nodes[0].get_children())
        return ret

    def _is_function_safe(self, node, safe_args=False):
        pass

    def _is_asserted(self, node): # If there is an assert on the value of the node, it's very likely to be safe
        all_assert = list(node.scope().nodes_of_class(astroid.Assert))
        while len(all_assert) > 0:
            for n in all_assert:
                if isinstance(n, astroid.Name) and n.name == node.name:
                    return True
                else:
                    all_assert = all_assert[1:] + list(all_assert[0].get_children())
        return False

    def _get_attribute_chain(self, node):
        return node.attrname #FIXME
        """
        chain = '' 
        n = node
        while hasattr(n, 'expr'):
            if isinstance(n.expr, astroid.Call):
                chain = n.expr.func.name + '()' + '.' + n.attrname + '.' + chain
                n = n.func.expr if hasattr(n.expr.func, 'expr') else None
            else:
                chain = n.attrname + '.' + chain
                n = n.expr
        if isinstance(n, astroid.Name):
            chain = n.name + '.' + chain
        return chain[:-1]
        """

    def _is_fstring_cst(self, node, args_allowed=False):
        formatted_string = []
        for format_node in node.values:
            if isinstance(format_node, astroid.FormattedValue):
                if isinstance(format_node.value, astroid.Attribute) and format_node.value.attrname.startswith('_'):
                    formatted_string += ['table_name']
                    continue
                operand = self._tracing_is_constexpr(format_node.value, args_allowed)
                if not operand:
                    return False
                else:
                    formatted_string += [operand]
            elif isinstance(format_node, astroid.Const):
                formatted_string += format_node.value
        return True

    def _tracing_is_constexpr(self, node, args_allowed = False, position=None):
        value = self._is_constexpr(node, args_allowed, position)
        if not value:
            self.Failures.append(node)
        return value

    def _is_constexpr(self, node, args_allowed = False, position=None):
        global func_call
        global func_called_for_query
        if isinstance(node, astroid.Const): # astroid.const is always safe
            return True
        elif isinstance(node, astroid.List):
            for l in node.elts:
                value = self._tracing_is_constexpr(l, args_allowed)
                if not value:
                    return False
            return True
        elif isinstance(node, astroid.Tuple):
            if position is None:
                for child in node.get_children():
                    if not self._tracing_is_constexpr(child, args_allowed):
                        return False
                return True
            else: 
                return self._tracing_is_constexpr(node.elts[position], args_allowed)
        elif isinstance(node, astroid.Set):
            for elem in node.elts: 
                if not self._tracing_is_constexpr(elem):
                    return False
            return True
        elif isinstance(node, astroid.BinOp): # recusively infer both side of the operation, then make the operation. Failing if either side is not inferable
            if (isinstance(node.left, astroid.Const) and node.left.value == '') or (isinstance(node.right, astroid.Const) and node.right.value == ''):
                return False
            elif isinstance(node.right, astroid.Dict): #case only for %(var)s
                dic = {}
                for value in node.right.items:
                    key = self._tracing_is_constexpr(value[0], args_allowed)
                    value = self._tracing_is_constexpr(value[1], args_allowed)
                    if not key or not value:
                        return False
                    else:
                        dic[key] = value
                left = self._tracing_is_constexpr(node.left, args_allowed)
                if not left:
                    return False
                else:
                    return True
            else:
                left_operand = self._tracing_is_constexpr(node.left, args_allowed)
                right_operand = self._tracing_is_constexpr(node.right, args_allowed)
                if not left_operand or not right_operand:
                    return False
                else:
                    return  True
        elif isinstance(node, astroid.Name) or isinstance(node, astroid.AssignName): # Variable: find the assignement instruction in the AST and infer its value.
            assignements = node.lookup(node.name)
            assigned_node = []
            for n in assignements[1]:
                if isinstance(n.parent, astroid.FunctionDef):
                    assigned_node += [args_allowed]
                elif isinstance(n.parent, astroid.Arguments):
                    assigned_node += [args_allowed]
                elif isinstance(n.parent, astroid.Tuple): # multi assign a,b = (a,b)
                    if isinstance(n.statement(), astroid.For):
                        assigned_node += [self._tracing_is_constexpr(n.statement().iter, args_allowed)]
                    else:
                        assigned_node += [self._tracing_is_constexpr(n.statement().value, args_allowed, position=n.parent.elts.index(n))]
                elif isinstance(n.parent, astroid.For):
                    assigned_node += [False] #TODO
                elif isinstance(n.parent, astroid.AugAssign):
                    left = self._tracing_is_constexpr(n.parent.target, args_allowed)
                    right = self._tracing_is_constexpr(n.parent.value, args_allowed)
                    if not left or not right:
                        assigned_node += [False]
                    else:
                        assigned_node += [True]
                elif isinstance(n.parent, astroid.Module):
                    return True 
                else:
                    assigned_node += [self._tracing_is_constexpr(n.parent.value, args_allowed)]
            if False in assigned_node or len(assigned_node) == 0:
                if not self._is_asserted(node):
                    pass
                return False or self._is_asserted(node)
            else:
                return True
        elif isinstance(node, astroid.JoinedStr):
            return self._is_fstring_cst(node, args_allowed)
        elif isinstance(node, astroid.Call) and isinstance(node.func, astroid.node_classes.Attribute):
            if node.func.attrname == 'format':
                key_value_arg = []
                if not node.keywords: # no args in format
                    return self._tracing_is_constexpr(node.func.expr, args_allowed)
                else:
                    for key in node.keywords:
                        inferred_value = self._tracing_is_constexpr(key.value, args_allowed)
                        if not inferred_value:
                            return False
                        else:
                            key_value_arg += [True]
                return True
            elif node.func.attrname == 'substitute':
                return False #Never used in code
            else:
                if 'fun_' + node.func.attrname ==  'fun_' + node.scope().name: # that is a .super() call
                    return True
                if 'fun_' + node.func.attrname not in func_called_for_query:
                    func_called_for_query.append(('fun_' + node.func.attrname, position))
                cst_args = True
                for arg in node.args:
                    if not self._tracing_is_constexpr(arg, args_allowed):
                        cst_args = False
                if 'fun_' + node.func.attrname in  func_call.keys():
                    for fun in func_call['fun_' + node.func.attrname]:
                        func_call['fun_' + node.func.attrname].pop(func_call['fun_' + node.func.attrname].index(fun))
                        for returnNode in self._get_return_node(fun):
                            if not self._tracing_is_constexpr(returnNode.value):
                                return False
                    return True
                return True
        elif isinstance(node, astroid.Call):
            if 'fun_' + node.func.name not in func_called_for_query:
                func_called_for_query.append(('fun_' + node.func.name, position))
            cst_args = True
            for arg in node.args:
                if not self._tracing_is_constexpr(arg, args_allowed):
                    cst_args = False
            if 'fun_' + node.func.name in  func_call.keys():
                if 'fun_' + node.func.name ==  'fun_' + node.scope().name: # that is a .super() call
                    return True
                for fun in func_call['fun_' + node.func.name]:
                    func_call['fun_' + node.func.name].pop(func_call['fun_' + node.func.name].index(fun))
                    for returnNode in self._get_return_node(fun):
                        if not self._tracing_is_constexpr(returnNode.value,cst_args, position):
                            func_call.pop('fun_' + node.func.name)
                            return False
                return True
            return True
        elif isinstance(node, astroid.IfExp):
            body = self._tracing_is_constexpr(node.body, args_allowed)
            orelse = self._tracing_is_constexpr(node.orelse, args_allowed)
            if not body or not orelse:
                return False
            else:
                return True
        elif isinstance(node, astroid.Subscript):
            return self._tracing_is_constexpr(node.value, args_allowed)
        elif isinstance(node, astroid.BoolOp):
            if node.op == 'or':
                for val in node.values:
                    cst = self._tracing_is_constexpr(val, args_allowed)
                    if not cst:
                        return False
                return True
            elif node.op == 'and':
                return self._tracing_is_constexpr(node.values[1], args_allowed)
            else:
                return False

        elif isinstance(node, astroid.Attribute):
            attr_chain = self._get_attribute_chain(node)
            if attr_chain in ATTRIBUTE_WHITELIST or node.attrname.startswith('_'):
                return True
            else:
                return False

    def _get_cursor_name(self, node):
        expr_list = []
        node_expr = node.expr
        while isinstance(node_expr, astroid.Attribute):
            expr_list.insert(0, node_expr.attrname)
            node_expr = node_expr.expr
        if isinstance(node_expr, astroid.Name):
            expr_list.insert(0, node_expr.name)
        cursor_name = '.'.join(expr_list)
        return cursor_name

    def _allowable(self, node):
        """
        :type node: NodeNG
        """
        infered = utils.safe_infer(node)
        infered_value = self._is_constexpr(node)
        # The package 'psycopg2' must be installed to infer
        # ignore sql.SQL().format or variable that can be infered as constant
        if infered and infered.pytype().startswith('psycopg2'):
            return True
        if infered_value: # If we can infer the value at compile time, it cannot be injected
            return True
        if isinstance(node, astroid.Call):
            node = node.func
        if isinstance(node.scope(), astroid.FunctionDef) and node.scope().name.startswith("_"):
            return True
        # self._thing is OK (mostly self._table), self._thing() also because
        # it's a common pattern of reports (self._select, self._group_by, ...)
        return (isinstance(node, astroid.Attribute)
            and isinstance(node.expr, astroid.Name)
            and node.attrname.startswith('_')
        )

    def _check_concatenation(self, node):
        node = self.resolve(node)

        if self._allowable(node):
            return False

        if isinstance(node, astroid.BinOp) and node.op in ('%', '+'):
            if isinstance(node.right, astroid.Tuple):
                # execute("..." % (self._table, thing))
                if not all(map(self._allowable, node.right.elts)):
                    return True
            elif isinstance(node.right, astroid.Dict):
                # execute("..." % {'table': self._table}
                if not all(self._allowable(v) for _, v in node.right.items):
                    return True
            elif not self._allowable(node.right):
                # execute("..." % self._table)
                return True
            # Consider cr.execute('SELECT ' + operator + ' FROM table' + 'WHERE')"
            # node.repr_tree()
            # BinOp(
            #    op='+',
            #    left=BinOp(
            #       op='+',
            #       left=BinOp(
            #          op='+',
            #          left=Const(value='SELECT '),
            #          right=Name(name='operator')),
            #       right=Const(value=' FROM table')),
            #    right=Const(value='WHERE'))
            # Notice that left node is another BinOp node
            return self._check_concatenation(node.left)

        # check execute("...".format(self._table, table=self._table))
        if isinstance(node, astroid.Call) \
                and isinstance(node.func, astroid.Attribute) \
                and node.func.attrname == 'format':

            return not (
                    all(map(self._allowable, node.args or []))
                and all(self._allowable(keyword.value) for keyword in (node.keywords or []))
            )

        # check execute(f'foo {...}')
        if isinstance(node, astroid.JoinedStr):
            return not all(
                self._allowable(formatted.value)
                for formatted in node.nodes_of_class(astroid.FormattedValue)
            )

    def resolve(self, node):
        # if node is a variable, find how it was built
        if isinstance(node, astroid.Name):
            for target in node.lookup(node.name)[1]:
                # could also be e.g. arguments (if the source is a function parameter)
                if isinstance(target.parent, astroid.Assign):
                    # FIXME: handle multiple results (e.g. conditional assignment)
                    return target.parent.value
        # otherwise just return the original node for checking
        return node

    def _check_sql_injection_risky(self, node):
        # Inspired from OCA/pylint-odoo project
        # Thanks @moylop260 (Moisés López) & @nilshamerlinck (Nils Hamerlinck)
        global func_call
        if isinstance(node.scope(), astroid.FunctionDef) and not  node.scope().name.startswith('__') and node.scope().name not in FUNCTION_WHITELIST: 
            if 'fun_' + node.scope().name not in  func_call.keys():#the fun prefix is to avoid overriding __init__ of the dict 
                func_call['fun_' + node.scope().name] = [node.scope()]
            else: 
                if node.scope() not in func_call[ 'fun_' +  node.scope().name]:
                    func_call['fun_' +  node.scope().name].append(node.scope())
            #print(len(func_call))
        if isinstance(node.scope(), astroid.FunctionDef) and not  node.scope().name.startswith('__') and node.scope().name not in FUNCTION_WHITELIST: 
            mapped_func_called_for_query = list(map(lambda x:x[0], func_called_for_query))
            if 'fun_' + node.scope().name in mapped_func_called_for_query:
                index = mapped_func_called_for_query.index('fun_' + node.scope().name)
                position = func_called_for_query[index][1]
                func_called_for_query.pop(index)
                for return_node in self._get_return_node(node.scope()):
                    if not self._is_constexpr(return_node.value, position):
                        return True
                
        current_file_bname = os.path.basename(self.linter.current_file)
        if not (
            # .execute() or .executemany()
            isinstance(node, astroid.Call) and node.args and
            isinstance(node.func, astroid.Attribute) and
            node.func.attrname in ('execute', 'executemany') and
            # cursor expr (see above)
            self._get_cursor_name(node.func) in DFTL_CURSOR_EXPR and
            # ignore in test files, probably not accessible
            not current_file_bname.startswith('test_')
        ):
            return False
        first_arg = node.args[0]

        is_concatenation = self._check_concatenation(first_arg)
        if is_concatenation is not None:
            return is_concatenation

        return True

    @checkers.utils.check_messages('sql-injection')
    def visit_call(self, node):
        if self._check_sql_injection_risky(node):
            self.add_message('sql-injection', node=node)


def register(linter):
    linter.register_checker(OdooBaseChecker(linter))
