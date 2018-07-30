import astroid
import re

from pylint import checkers, interfaces

class SQLInjectionChecker(checkers.BaseChecker):
    __implements__ = interfaces.IAstroidChecker

    name = 'sql-check'
    priority = -1
    msgs = {
        'E6008': ('Possible SQL injection vector through string-based query construction',
                  'sql-injection',
                  'Test for SQL injection'),
    }

    SIMPLE_SQL_RE = re.compile(
        r'(select\s.*from\s|'
        r'delete\s+from\s|'
        r'insert\s+into\s.*values\s|'
        r'update\s.*set\s)',
        re.IGNORECASE | re.DOTALL,
    )

    def _check_string(self, data):
        return self.SIMPLE_SQL_RE.search(data) is not None

    def _evaluate_ast(self, node):
        wrapper = None
        statement = ''
        if isinstance(node.parent, astroid.BinOp):
            out = self.string_concat(node, node.parent)
            wrapper = out[0].parent
            statement = out[1]

        elif (isinstance(node.parent, astroid.Attribute) \
              and node.parent.attrname == 'format'):
            if isinstance(node, astroid.Const):
                statement = node.value
            wrapper = node.parent.parent.parent

        if isinstance(wrapper, astroid.Call):
            names = ['execute', 'executemany']
            name = self.get_called_name(wrapper)
            return (name in names, statement)
        else:
            return (False, statement)

    def string_concat(self, node, stop=None):
        bits = [node]
        return (node, " ".join([x.value for x in bits if isinstance(x, astroid.Const) and isinstance(x.value, str)]))

    def get_called_name(self, node):
        function = node.func
        try:
            return function.attrname if isinstance(function, astroid.Attribute) else function.id
        except AttributeError:
            return ""

    def visit_default(self, node):
        val = self._evaluate_ast(node)
        if self._check_string(val[1]):
            self.add_message('sql-injection', node=node, line=node.fromlineno)


def register(linter):
    linter.register_checker(SQLInjectionChecker(linter))
