
def _quote(val):
    if '"' not in val:
        return '"%s"' % val
    return val


class Expression(object):

    __slots__ = ('left', 'op', 'right')

    def __init__(self, op, left, right):
        self.op = op
        self.left = left
        self.right = right

    def __and__(self, other):
        return Expression('AND', self, other)

    def __or__(self, other):
        return Expression('OR', self, other)

    def __xor__(self, other):
        return Expression('IN', self, other)

    def __invert__(self):
        return Expression('NOT', self, None)

    def __eq__(self, other):
        if other is None:
            return Expression('IS', self, 'NULL')
        return Expression('=', self, other)

    def __ne__(self, other):
        if other is None:
            return Expression('IS NOT', self, 'NULL')
        return Expression('!=', self, other)

    def __lt__(self, other):
        return Expression('<', self, other)

    def __le__(self, other):
        return Expression('<=', self, other)

    def __gt__(self, other):
        return Expression('>', self, other)

    def __ge__(self, other):
        return Expression('>=', self, other)

    def __to_sql__(self):
        left = "(%s " % self.left.__to_sql__()
        op = "%s " % self.op

        if isinstance(self.right, Expression):
            right = "%s)" % self.right.__to_sql__()
        else:
            right = "%s)" % str(self.right)

        return left + op + right


class Column(Expression):

    __slots__ = ('_row', '_name', '_qualified')

    def __init__(self, row, name):
        self._row = row
        self._name = _quote(name)
        self._qualified = '%s.%s' % (self._row._table, self._name)

    def __to_sql__(self):
        return self._qualified


class Row(object):

    __slots__ = ('_table', '_nullable')

    def __init__(self, table, nullable=False):
        self._table = _quote(table)
        self._nullable = nullable

    def __getattr__(self, name):
        if name.startswith('__'):
            raise AttributeError
        return Column(self, name)


class Join(object):

    def __init__(self, expression):
        self.expression = expression
        self.t1 = self.expression.left._row
        self.t2 = self.expression.right._row

        if self.t1._nullable:
            if self.t2._nullable:
                self.type = 'FULL JOIN'
            else:
                self.type = 'RIGHT JOIN'
        else:
            if self.t2._nullable:
                self.type = 'LEFT JOIN'
            else:
                self.type = 'INNER JOIN'

    def __to_sql__(self):
        return "%s %s ON %s" % (self.type, self.t2._table, self.expression.__to_sql__())


class Select(object):

    def __init__(self, columns, where=None, order=None):
        self.columns = columns
        self.aliased = isinstance(columns, dict)
        self.joins = []

        if self.aliased:
            self.tables = {self.columns[c]._row for c in self.columns}
        else:
            self.tables = {c._row for c in self.columns}

        self._where = where
        self.order = order

    def where(self, expression):
        if self._where is not None:
            self._where &= expression
        else:
            self._where = expression

    def join(self, *expressions):
        for exp in expressions:
            assert (isinstance(exp.left, Column) and isinstance(exp.right, Column)), \
                "The operands of a join predicate MUST be Columns."
            assert exp.left._row in self.tables, \
                "The left hand side operand of the join predicate must be in the FROM clause."
            self.joins.append(Join(exp))

    def _build_joins(self):
        return ' '.join([j.__to_sql__() for j in self.joins])

    def _build_columns(self):
        if self.aliased:
            return ', '.join(["%s AS %s" % (self.columns[c]._qualified, c) for c in self.columns])
        return ', '.join(["%s" % c._qualified for c in self.columns])

    def _build_tables(self):
        return ', '.join(["%s" % t._table for t in self.tables])

    def build(self):
        query = "SELECT %s FROM %s"
        args = []

        args.append(self._build_columns())
        args.append(self._build_tables())

        joins = self._build_joins()

        if joins:
            query += " %s"
            args.append(joins)

        if self._where:
            query += " WHERE %s"
            args.append(self._where.__to_sql__())

        return query % tuple(args)
