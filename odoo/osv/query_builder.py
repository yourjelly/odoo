# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.


def _quote(val):
    """ Helper function for quoting SQL identifiers. """
    if '"' not in val:
        return '"%s"' % val
    return val


class Expression(object):

    """
    Main Abstract Syntax Tree of the query builder.
    """

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

    def __abs__(self):
        return Func('ABS', self)

    def __pow__(self, other):
        return Func('POW', self, other)

    def __mod__(self, other):
        return Func('MOD', self, other)

    def __ceil__(self):
        return Func('CEIL', self)

    def __floor__(self):
        return Func('FLOOR', self)

    def __trunc__(self):
        return Func('TRUNC', self)

    def __round__(self, ndigits=2):
        return Func('ROUND', self, ndigits)

    def __to_sql__(self):
        # TODO: Optimize parentheses generation
        left, args = self.left.__to_sql__()

        if self.op == 'NOT':
            return ("(NOT %s)" % left, args)

        sql = "(%s %s " % (left, self.op)

        if isinstance(self.right, Expression):
            right, _args = self.right.__to_sql__()
            args += _args
            sql += right + ')'
        else:
            if self.right == 'NULL':
                sql += 'NULL)'
            else:
                args.append(self.right)
                sql += '%s)'

        return (sql, args)


class Func(Expression):

    __slots__ = ('func', 'args')

    def __init__(self, func, *args):
        self.func = func
        self.args = args

    def __to_sql__(self):
        sql = '(%s(' % self.func
        args = []

        for arg in self.args:
            if isinstance(arg, Expression):
                _sql, _args = arg.__to_sql__()
                sql += _sql
                args += _args
            else:
                args.append(arg)
                sql += '%s'
            if arg is not self.args[-1]:
                sql += ', '

        sql += '))'
        return (sql, args)


class SelectOp(Expression):

    __slots__ = ('op', 'left', 'right')

    def __to_sql__(self):
        left, largs = self.left.__to_sql__()
        right, rargs = self.right.__to_sql__()
        return ("(%s) %s (%s)" % (left, self.op, right), largs + rargs)


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
        """
        Create an object that represents any row of a table.

        Args:
            table (str): Name of the table.
            nullable (bool): In the case of a join, whether the NULLs of this
                table should be used in the resulting joined table.
        """
        self._table = _quote(table)
        self._nullable = nullable

    def __getattr__(self, name):
        if name.startswith('__'):
            raise AttributeError
        return Column(self, name)


class Join(object):

    def __init__(self, expression):
        """
        Create a join between two tables on a given condition.

        /!\ This class should *NOT* be used on its own, the Select class already takes care
            of creating the appropriate Join objects /!\

        The type of join depends on each table's `_nullable` boolean flag:
            If LHS is _nullable and RHS is _nullable, the type is a FULL JOIN
            If LHS is _nullable and RHS is not _nullable, the type is a LEFT JOIN

        Args:
            expression (Expression): an AST expression which will serve as the ON condition for the
                Join. At the moment, both sides of the expression must be Columns, as it is
                the most common case and this allows us to infer the tables to join from the
                condition expression.
        """
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
    # TODO: Make smarter joins, if the table of the RHS operand of the join predicate
    # is already in the select's _tables attribute, then remove it, this allows
    # for the columns to be columns from the joined table without the need to
    # force a cartesian product

    def __init__(self, columns, where=None, order=[], joins=[], distinct=False,
                 group=[], limit=None, offset=0):
        """
        Stateless class for generating SQL SELECT statements.

        Args:
            columns: Either a list of Column for the output table or a dictionary
                of alias: Column, these will be used in the 'SELECT x' part of
                the query.
            where (Expression): An AST expression for filtering out the results of the query.
            order: A list of (potentially modified) columns to order by.
            joins: A list of expressions by which to join different tables based on a condition.
            distinct: A list of columns to be fetched only if they're not the same.

        Example:
            p = Row('res_partner', True)
            u = Row('res_users')
            s = Select({'id': p.id}, p.name != None, [Desc(p.id)], [p.id == u.partner_id])

            >>> s.__to_sql__()

            SELECT "res_partner"."id" AS id
            LEFT JOIN "res_users" ON "res_partner"."id" = "res_users"."partner_id"
            WHERE ("res_partner"."name" IS NOT NULL)
            ORDER BY "res_partner"."id" DESC NULLS LAST
        """
        self.attrs = {}

        self.attrs['columns'] = self._columns = columns
        self.attrs['where'] = self._where = where
        self.attrs['order'] = self._order = order
        self.attrs['joins'] = self._joins = joins
        self.attrs['distinct'] = self._distinct = distinct
        self.attrs['group'] = self._group = group
        self.attrs['limit'] = self._limit = limit
        self.attrs['offset'] = self._offset = offset

        self._aliased = isinstance(columns, dict)

        if self._aliased:
            # If the columns argument is a dict, it can only contain Row objects.
            self._tables = sorted({self._columns[c]._row for c in self._columns})
        else:
            # If the columns argument is a list, it can contain Row objects.
            # or Column objects.
            tables = set()
            for col in self._columns:
                if isinstance(col, Row):
                    tables.add(col)
                else:
                    tables.add(col._row)
            self._tables = sorted(tables, key=lambda r: r._table)


    def __add__(self, other):
        return SelectOp('UNION', self, other)

    def __sub__(self, other):
        return SelectOp('INTERSECT', self, other)

    def __truediv__(self, other):
        return SelectOp('EXCEPT', self, other)

    # py2compat
    __div__ = __truediv__

    def columns(self, *cols):
        """ Create a similar Select object but with different output columns."""
        return Select(**{**self.attrs, 'columns': cols})

    def distinct(self):
        """ Create a similar Select object but toggle the distinct flag."""
        # TODO: Optimize so as to never actually use the distinct keyword
        return Select(**{**self.attrs, 'distinct': not self.attrs['distinct']})

    def where(self, expression):
        """ Create a similar Select object but with a different where clause."""
        return Select(**{**self.attrs, 'where': expression})

    def join(self, *expressions):
        """ Create a similar Select object but with different joins."""
        return Select(**{**self.attrs, 'joins': expressions})

    def order(self, *expressions):
        """ Create a similar Select object but with a different order by clause."""
        return Select(**{**self.attrs, 'order': expressions})

    def group(self, *expressions):
        """ Create a similar Select object but with a different group by clause."""
        return Select(**{**self.attrs, 'group': expressions})

    def limit(self, n):
        """ Create a similar Select object but with a different limit."""
        return Select(**{**self.attrs, 'limit': n})

    def offset(self, n):
        """ Create a similar Select object but with a different offset."""
        return Select(**{**self.attrs, 'offset': n})

    def _build_joins(self):
        sql = []
        args = []

        for join in self._joins:
            _sql, _args = Join(join).__to_sql__()
            sql.append(_sql)
            args += _args

        return (''.join(sql), args)

    def _build_columns(self):
        res = []

        for c in self._columns:
            if isinstance(c, Row):
                sql = "*"
            elif self._aliased:
                sql = "%s AS %s" % (self._columns[c]._qualified, c)
                c = self._columns[c]
            else:
                sql = "%s" % c._qualified
            res.append(sql)

        return ', '.join(res)

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

    def _build_group(self):
        if self._group:
            sql = " GROUP BY %s"
            return sql % ', '.join([g.__to_sql__()[0] for g in self._group])
        return ''

    def _build_limit(self):
        if self._limit:
            sql = " LIMIT %s OFFSET %s"
            return sql, [self._limit, self._offset]
        return '', []

    def __to_sql__(self):
        """
        Generate a SQL (Postgres) statement from the different parts of the Select object.

        Returns:
            tuple: The SQL query as a string and the arguments to be passed to cr.execute as list.
        """
        sql = "SELECT %s%s FROM %s" % ('DISTINCT ' if self._distinct else '',
                                       self._build_columns(), self._build_tables())
        args = []

        def with_args(f):
            # access parent f(x)'s query and args and modify them
            nonlocal sql, args
            _sql, _args = f()
            sql += "%s" % _sql
            args += _args

        with_args(self._build_joins)
        with_args(self._build_where)

        sql += self._build_order()
        sql += self._build_group()

        with_args(self._build_limit)

        return (sql, args)
