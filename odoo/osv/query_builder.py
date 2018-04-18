


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
        left, args = self.left.__to_sql__()

        if self.op == 'NOT':
            return ("(NOT %s)" % left, args)

        sql = "(%s %s " % (left, self.op)

        if isinstance(self.right, Expression):
            right, rargs = self.right.__to_sql__()
            args += rargs
            sql += right + ')'
        else:
            if self.right == 'NULL':
                sql += 'NULL)'
            else:
                args.append(self.right)
                sql += '%s)'

        return (sql, args)


class Column(Expression):

    __slots__ = ('_row', '_name', '_qualified')

    def __init__(self, row, name):
        self._row = row
        self._name = _quote(name)
        self._qualified = '%s.%s' % (self._row._table, self._name)

    def __to_sql__(self):
        return (self._qualified, [])


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
                self.type = 'LEFT JOIN'
        else:
            if self.t2._nullable:
                self.type = 'RIGHT JOIN'
            else:
                self.type = 'INNER JOIN'

    def __to_sql__(self):
        sql, args = self.expression.__to_sql__()
        return (" %s %s ON %s" % (self.type, self.t2._table, sql), args)


class Modifier(object):

    def __init__(self, column, modifier, nfirst=False):
        assert isinstance(column, Column), "Modifier requires a column!"
        self.column = column
        self.modifier = modifier
        self.nfirst = nfirst

    def __to_sql__(self):
        sql = self.column.__to_sql__()[0]
        sql += " %s " % self.modifier
        sql += "NULLS FIRST" if self.nfirst else "NULLS LAST"
        return sql, []


class Asc(Modifier):

    def __init__(self, column, nfirst=False):
        super(Asc, self).__init__(column, 'ASC', nfirst)


class Desc(Modifier):

    def __init__(self, column, nfirst=False):
        super(Desc, self).__init__(column, 'DESC', nfirst)


class Select(object):

    def __init__(self, columns, where=None, order=[], joins=[]):
        self._columns = columns
        self._aliased = isinstance(columns, dict)
        self._joins = [Join(join) for join in joins]

        if self._aliased:
            self._tables = sorted({self._columns[c]._row for c in self._columns})
        else:
            self._tables = sorted({c._row for c in self._columns}, key=lambda r: r._table)

        self._where = where
        self._order = order

    def where(self, expression):
        return Select(self._columns, expression, self._order)

    def join(self, *expressions):
        return Select(self._columns, self._where, self._order, expressions)

    def order(self, expression):
        self._order += expression

    def _build_joins(self):
        sql = []
        args = []

        for join in self._joins:
            jsql, jargs = join.__to_sql__()
            sql.append(jsql)
            args += jargs

        return (''.join(sql), args)

    def _build_columns(self):
        if self._aliased:
            return ', '.join(["%s AS %s" % (self._columns[c]._qualified, _quote(c))
                              for c in self._columns])
        return ', '.join(["%s" % c._qualified for c in self._columns])

    def _build_tables(self):
        return ', '.join(["%s" % t._table for t in self._tables])

    def _build_where(self):
        sql = " WHERE %s"
        if self._where:
            where, args = self._where.__to_sql__()
            return (sql % where, args)
        return ('', [])

    def _build_order(self):
        if self._order:
            sql = " ORDER BY %s"
            return sql % ', '.join([o.__to_sql__()[0] for o in self._order])
        return ''

    def __to_sql__(self):
        query = "SELECT %s FROM %s" % (self._build_columns(), self._build_tables())
        args = []

        jsql, jargs = self._build_joins()
        query += "%s" % jsql
        args += jargs

        wsql, wargs = self._build_where()
        query += "%s" % wsql
        args += wargs

        query += self._build_order()

        return (query, args)
