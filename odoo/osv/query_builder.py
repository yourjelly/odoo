# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

"""
This python module contains a low-level SQL query builder, the generated SQL statements
are specific to the PostgreSQL idiom since its what Odoo uses, therefore it is guaranteed to work
with PostgreSQL, however it may still work with other RDBMS, but this is not guaranteed.

Usage:

The basic object needed for creating SQL statements and expressions is the `Row` object, it
represents (in an abstract manner) a row from a table, it requires  one argument for initialization
which is the name of the table, it accepts a second, optional argument as a flag called `nullable`,
this flag, when set to true, means "take the nulls from this table when performing a Join", which
helps in the inference of join types.

e.g. >>> res_partner = Row('res_partner', True)

One can access a row's columns by using pythonic attribute getting / dot notation.

e.g. >>> col = res_partner.id

Note that these objects are not DB-validated, meaning that one could create a Row object of a
table that does not exist in DB, or access a column that does not exist in a table's schema, the
performance cost of this kind of validation does not warrant its use-case, it is to be used
with caution as the "validation" will be done by Postgres itself.

Once a row object is created, one can perform pythonic expressions with its columns,
these expressions can then be translated into SQL expressions.

e.g. >>> expr = res_partner.id == 5
     >>> expr._to_sql()
     ... ('"res_partner"."id" = %s', [5])

Three things to note from the previous example:

    * SQL Identifiers are automatically double-quoted.

    * Expressions are automatically parenthesized.

    * Literals are not directly interpolated into the SQL string, instead string interpolation
      placeholders are put in their place and the actual literals are appended to a list of
      arguments (order matters!). This tuple can then be passed directly to cr.execute(), which
      will properly perform the interpolation without the risk of SQL-Injections.

Rows, Columns and Expressions are the building blocks of the query builder, but they're
pretty useless by themselves, to create meaningful SQL statements, one should use
the Select, Insert and Delete classes for creating the corresponding SQL statements, in order
to see their usage, consult the respective class' documentation.
"""

from collections import Iterable, OrderedDict
from functools import partial
from numbers import Number

from odoo.tools.pycompat import text_type


def _quote(val):
    """ Helper function for quoting SQL identifiers if necessary."""
    if '"' not in val:
        return '"%s"' % val
    return val


def generate_aliases():
    return iter('abcdefghijklmnopqrstuvwxyz')


class Expression(object):

    """
    Main Abstract Syntax Tree of the query builder.

    Valid expressions:
        a & b  -> a AND b, both operands must be Expressions
        a | b  -> a OR b, both operands must be Expressions
        a ^ b  -> a IN b, b must be an iterable (tuple, list, set, ...)
        ~a     -> NOT a, a must be an Expression
        a == b -> a = b
        a != b -> a != b
        a < b  -> a < b
        a <= b -> a <= b
        a > b  -> a > b
        a >= b -> a >= b
        a @ b  -> a LIKE b, b must be a string type
    """

    __slots__ = ('left', 'op', 'right')

    def __init__(self, op, left, right):
        self.op = op
        self.left = left
        self.right = right

    def __and__(self, other):
        assert isinstance(other, Expression), "`&` operands must be Expressions."
        return Expression('AND', self, other)

    def __or__(self, other):
        assert isinstance(other, Expression), "`|` operands must be Expressions."
        return Expression('OR', self, other)

    def __xor__(self, other):
        assert isinstance(other, (Iterable, QueryExpression)), "`^` RHS operand must be Iterable."
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

    def __matmul__(self, other):
        assert isinstance(other, text_type), "`@` RHS operand must be a text type."
        return Expression('LIKE', self, other)

    def ilike(self, other):
        assert isinstance(other, text_type), "`ilike` argument must be a text type."
        return Expression('ILIKE', self, other)

    def __abs__(self):
        return Func('ABS', self)

    def __pow__(self, other):
        assert isinstance(other, Number), "`**` RHS operand must be a numeric type."
        return Func('POW', self, other)

    def __mod__(self, other):
        assert isinstance(other, Number), "`%` RHS operand must be a numeric type."
        return Func('MOD', self, other)

    def _to_sql(self, alias_mapping):
        """
        Generates SQL statements and expressions from the current object.

        Returns:
            A tuple containing an SQL string and a list of arguments to be interpolated into
            the string, to be fed directly into cr.execute()
        """
        # TODO: Optimize parentheses generation
        left, args = self.left._to_sql(alias_mapping)

        if self.op == 'NOT':
            return ("(NOT %s)" % left, args)

        sql = "(%s %s " % (left, self.op)

        if isinstance(self.right, Expression):
            right, _args = self.right._to_sql(alias_mapping)

            if isinstance(self.right, QueryExpression):
                right = '(%s)' % right

            args += _args
            sql += right + ')'
        else:
            if self.right == 'NULL':
                sql += 'NULL)'
            else:
                args.append(self.right)
                sql += '%s)'

        return (sql, args)


class Row(object):

    __slots__ = ('_table', '_nullable', '_cols')

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
        self._cols = OrderedDict()

    def __call__(self, *args):
        for col in args:
            self._cols[col] = Column(self, col)
        return self

    def __getattr__(self, name):
        if name.startswith('__'):
            raise AttributeError
        if name in self._cols:
            return self._cols[name]
        return Column(self, name)

    def _to_sql(self, alias_mapping, with_cols=False):
        if with_cols:
            if self._cols:
                return "%s(%s)" % (self._table, ', '.join([c._name for c in self._cols.values()]))
            return "%s" % self._table
        return "%s %s" % (self._table, alias_mapping[self])


class Column(Expression):

    __slots__ = ('_row', '_name', '_val')

    def __init__(self, row, name):
        """
        A table's column.

        Should rarely be used by the user, it is automatically handled by the Row class.

        Args:
            row (Row): Row that this column belongs to (table).
            name (str): Name of the column.
        """
        self._row = row
        self._name = _quote(name)
        self._val = None

    def __lshift__(self, other):
        self._val = other
        return self

    def _to_sql(self, alias_mapping=None):
        qualified = "{0}.%s" % self._name
        row = self._row

        if alias_mapping is not None:
            col_name = qualified.format(alias_mapping[row])
        else:
            col_name = qualified.format(row._table)

        if self._val is not None:
            if isinstance(self._val, Column):
                _sql, _args = self._val._to_sql(alias_mapping)
                return "%s = %s" % (col_name, _sql), _args
            elif isinstance(self._val, Select):
                _sql, _args = self._val._to_sql(alias_mapping)
                return "%s = (%s)" % (col_name, _sql), _args
            return "{0} = %s".format(col_name), [self._val]
        return col_name, []


class BaseQuery(object):

    def __init__(self, *args, **kwargs):
        """
        Helper class for combining the different parts of any Query object.
        """
        self.sql = []
        self.args = []

    def _build_base(self, alias_mapping):
        raise NotImplementedError

    def _build_from(self, alias_mapping):
        rows = getattr(self, '_rows', False)

        if rows:
            sql = []
            for row in rows:
                if isinstance(row, tuple):
                    sql.append(row[0]._to_sql(alias_mapping))
                    self.args += row[1]
                else:
                    sql.append(row._to_sql(alias_mapping))

            self.sql.append("FROM %s" % ', '.join(sql))

    def _build_joins(self, alias_mapping):
        pass

    def _build_using(self, alias_mapping):
        pass

    def _build_where(self, alias_mapping):
        where = getattr(self, '_where', False)

        if where:
            sql, args = where._to_sql(alias_mapping)
            self.sql.append("WHERE %s" % sql)
            self.args += args

    def _build_order(self, alias_mapping):
        pass

    def _build_group(self, alias_mapping):
        pass

    def _build_having(self, alias_mapping):
        pass

    def _build_limit(self, alias_mapping):
        pass

    def _build_do(self, alias_mapping):
        pass

    def _build_returning(self, alias_mapping):
        returning = getattr(self, '_returning', False)
        args = []

        if returning:
            sql = []

            for e in returning:
                if isinstance(e, Row):
                    sql.append('*')
                    break
                else:
                    # Column or Expression
                    _sql, _args = e._to_sql(alias_mapping)
                    sql.append(_sql)
                    args += _args

            self.sql.append("RETURNING %s" % ', '.join(sql))
            self.args += args

    def _build_all(self, alias_mapping):
        # Order matters!!
        self._build_base(alias_mapping)
        self._build_from(alias_mapping)
        self._build_joins(alias_mapping)
        self._build_using(alias_mapping)
        self._build_where(alias_mapping)
        self._build_order(alias_mapping)
        self._build_group(alias_mapping)
        self._build_having(alias_mapping)
        self._build_limit(alias_mapping)
        self._build_do(alias_mapping)
        self._build_returning(alias_mapping)

    def _to_sql(self, alias_mapping):
        self._build_all(alias_mapping)
        self.sql = [sql for sql in self.sql if sql]
        res = ' '.join(self.sql), self.args
        self.sql = []
        self.args = []
        return res

    def to_sql(self):
        return self._to_sql(AliasMapping())


class QueryExpression(Expression):

    __slots__ = ('op', 'left', 'right')

    """ Class for operators between Select objects."""

    def __init__(self, op, left, right):
        super(QueryExpression, self).__init__(op, left, right)

    def __or__(self, other):
        op = 'UNION ALL' if other._all else 'UNION'
        return QueryExpression(op, self, other)

    def __and__(self, other):
        op = 'INTERSECT ALL' if other._all else 'INTERSECT'
        return QueryExpression(op, self, other)

    def __sub__(self, other):
        op = 'EXCEPT ALL' if other._all else 'EXCEPT'
        return QueryExpression(op, self, other)

    def _to_sql(self, alias_mapping):
        left, largs = self.left._to_sql(alias_mapping)
        right, rargs = self.right._to_sql(AliasMapping())
        return ("(%s) %s (%s)" % (left, self.op, right), largs + rargs)

    def to_sql(self):
        return self._to_sql(AliasMapping())


class AliasMapping(dict):

    def __init__(self, *args, **kwargs):
        """
        A special implementation of dict that generates appropriate table aliases on the fly.
        """
        super(AliasMapping, self).__init__()
        self._generator = generate_aliases()

    def __missing__(self, k):
        alias = _quote(next(self._generator))
        self[k] = alias
        return alias


class Join(object):

    def __init__(self, expression):
        """
        Create a join between two tables on a given condition.

        /!\ This class should *NOT* be used on its own, the Select class already takes care
            of creating the appropriate Join objects /!\

        The type of join depends on each table's `_nullable` boolean flag:
            If LHS is nullable and RHS is nullable, the type is a FULL JOIN
            If LHS is nullable and RHS is not nullable, the type is a LEFT JOIN
            If LHS is not nullable and RHS is nullable, the type is a RIGHT JOIN
            If LHS is not nullable and RHS is not nullable, the type is an INNER JOIN

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

    def _to_sql(self, alias_mapping):
        sql, args = self.expression._to_sql(alias_mapping)
        return ("%s %s %s ON %s" % (self.type, self.t2._table, alias_mapping[self.t2], sql),
                args)


class Modifier(object):

    def __init__(self, column, modifier, nfirst=False):
        """
        Appends the specified modifier to the result of column._to_sql()

        Args:
            column (Column): The column to be modified.
            modifier (str): The modifier itself.
            nfirst (bool): Whether `NULLS FIRST` should be specified (default: False)
        """
        assert isinstance(column, Column), "Modifier requires a column!"
        self.column = column
        self.modifier = modifier
        self.nfirst = nfirst

    def _to_sql(self, alias_mapping):
        sql = self.column._to_sql(alias_mapping)[0]
        sql += " %s " % self.modifier
        sql += "NULLS FIRST" if self.nfirst else "NULLS LAST"
        return sql, []


class Asc(Modifier):

    """ Ascending order """

    def __init__(self, column, nfirst=False):
        super(Asc, self).__init__(column, 'ASC', nfirst)


class Desc(Modifier):

    """ Descending order """

    def __init__(self, column, nfirst=False):
        super(Desc, self).__init__(column, 'DESC', nfirst)


class Select(BaseQuery, QueryExpression):

    def __init__(self, columns, where=None, order=[], joins=[], distinct=False,
                 group=[], having=None, limit=None, offset=0, _all=False):
        """
        Stateless class for generating SQL SELECT statements.

        Args:
            columns: List of Column / Dictionary `{alias: Column}`.
                Alternatively, a single-element list containing a Row object
                can be provided, in which case it will be translated to 'SELECT *'
            where (Expression): Expression for filtering out the results of the query.
            order: List of (potentially modified) columns to order by.
            joins: List of expressions by which to join different tables based on a condition.
            distinct: Flag dictating whether records will be fetched if they're not the same.
            group: List of columns to order by.
            having (Expression): Condition for the group by.
            limit (int): Maximum amount of records to fetch.
            offset (int): Skip the first X records when performing a Select with a limit,
                has no effect if limit is not specified.

        Example:
            p = Row('res_partner', True)
            u = Row('res_users')
            s = Select({'id': p.id}, p.name != None, [Desc(p.id)], [p.id == u.partner_id])

            >>> s._to_sql()

            SELECT "res_partner"."id" AS id
            LEFT JOIN "res_users" ON "res_partner"."id" = "res_users"."partner_id"
            WHERE ("res_partner"."name" IS NOT NULL)
            ORDER BY "res_partner"."id" DESC NULLS LAST
        """
        super(Select, self).__init__()
        self.attrs = {}

        self.attrs['columns'] = self._columns = columns
        self.attrs['where'] = self._where = where
        self.attrs['order'] = self._order = order
        self.attrs['joins'] = self._joins = [Join(j) for j in joins if not isinstance(j, Join)]
        self.attrs['distinct'] = self._distinct = distinct
        self.attrs['group'] = self._group = group
        self.attrs['having'] = self._having = having
        self.attrs['limit'] = self._limit = limit
        self.attrs['offset'] = self._offset = offset
        self.attrs['_all'] = self._all = _all

        self._aliased = isinstance(columns, dict)
        self._rows = self._get_tables()

    def _get_tables(self):
        tables = []
        for col in self._columns:
            if self._aliased:
                # If the columns argument is a dict, it can only contain Row objects.
                # SELECT <col> AS <alias>
                t = self._columns[col]._row
            else:
                # If the columns argument is a list, it can contain Row or Column objects
                if isinstance(col, Row):
                    # SELECT *
                    t = col
                else:
                    # SELECT <col>
                    t = col._row

            if t not in [j.t2 for j in self._joins] and t not in tables:
                tables.append(t)
        return tables

    # Generation of new Select objects
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

    def having(self, expression):
        """ Create a similar Select object but with a different having clause. """
        return Select(**{**self.attrs, 'having': expression})

    def limit(self, n):
        """ Create a similar Select object but with a different limit."""
        return Select(**{**self.attrs, 'limit': n})

    def offset(self, n):
        """ Create a similar Select object but with a different offset."""
        return Select(**{**self.attrs, 'offset': n})

    def all(self):
        """ Create a similar Select object but with a different all."""
        return Select(**{**self.attrs, '_all': not self.attrs['_all']})

    def _build_base(self, alias_mapping):
        sql = ["SELECT"]

        if self._distinct:
            sql.append("DISTINCT")

        _sql = []
        for c in self._columns:
            if isinstance(c, Row):
                _sql.append("*")
            elif self._aliased:
                col = self._columns[c]
                _sql.append("%s AS %s" % (col._to_sql(alias_mapping)[0], c))
            elif isinstance(c, Unnest):
                # Special case, Unnest can be used in a FROM clause
                r = c._row[0]
                _sql.append(alias_mapping[r])
            else:
                _sql.append("%s" % c._to_sql(alias_mapping)[0])

        sql.append(', '.join(_sql))
        self.sql.append(' '.join(sql))

    def _build_joins(self, alias_mapping):
        sql = []
        args = []

        for join in self._joins:
            _sql, _args = join._to_sql(alias_mapping)
            sql.append(_sql)
            args += _args

        self.sql.append(' '.join(sql))
        self.args += args

    def _build_order(self, alias_mapping):
        if self._order:
            sql = "ORDER BY %s"
            self.sql.append(sql % ', '.join([o._to_sql(alias_mapping)[0] for o in self._order]))

    def _build_group(self, alias_mapping):
        if self._group:
            sql = "GROUP BY %s"
            self.sql.append(sql % ', '.join([g._to_sql(alias_mapping)[0] for g in self._group]))

    def _build_having(self, alias_mapping):
        if self._having:
            sql = "HAVING %s"
            having, args = self._having._to_sql(alias_mapping)
            self.sql.append(sql % having)
            self.args += args

    def _build_limit(self, alias_mapping):
        if self._limit:
            sql = "LIMIT %s OFFSET %s"
            self.sql.append(sql)
            self.args += [self._limit, self._offset]


class Delete(BaseQuery):

    def __init__(self, rows, using=[], where=None, returning=[]):
        """
        Stateless class for generating SQL DELETE statements.

        Args:
            rows: List of Row instances of the tables from which records will be deleted.
            using: List of Row instances that may appear in the query's expressions but that
                won't be deleted from.
            where (Expression): Expression that will filter the table for records to be deleted.
            returning: List of (Expression|Column|Row) to dictate what kind of output should be
                returned after executing the query.

        Example:
            >>> r = Row('res_partner')
            >>> d = Delete([r], where=r.active == False)
            >>> d.to_sql()
            DELETE FROM "res_partner" "a" WHERE "a"."active" = 'False'
        """
        super(Delete, self).__init__()
        self._rows = rows
        self._using = using
        self._where = where
        self._returning = returning

    def _build_base(self, alias_mapping):
        self.sql.append("DELETE")

    def _build_using(self, alias_mapping):
        if self._using:
            self.sql.append("USING %s" % ", ".join(
                ["%s %s" % (r._table, alias_mapping[r]) for r in self._using]
            ))


class With(object):

    def __init__(self, body, tail, recursive=False):
        """
        Class for creating WITH SQL statements.

        Args:
            body: List containing tuples in which the first element is a Row object, with defined
                _cols attribute, and the second element is an SQL query that returns an amount
                of rows equivalent to the amount of _cols defined, if the recursive flag is True,
                then these queries must be UNIONs between a base query and a recursive query.
            tail: An SQL query that (ideally) uses the results from the WITH table to generate
                its own result.
            recursive: Whether the WITH statement is RECURSIVE or not.

        /!\ BEWARE: By PostgreSQL's doc, calling recursive terms inside data-modifying queries
            is not permitted, therefore only SELECT queries can use recursive terms. /!\
        """
        self._body = body
        self._tail = tail
        self._recur = recursive

    def _to_sql(self, alias_mapping):
        sql = []
        args = []

        for row, statement in self._body:
            alias_mapping[row] = row._table
            _sql = [row._to_sql(alias_mapping, with_cols=True)]
            __sql, _args = statement._to_sql(alias_mapping)
            _sql.append(__sql)
            args += _args
            sql.append("%s AS (%s)" % tuple(_sql))

        _sql, _args = self._tail._to_sql(alias_mapping)
        args += _args

        return "WITH %s%s %s" % ("RECURSIVE " if self._recur else "", ', '.join(sql), _sql), args

    def to_sql(self):
        return self._to_sql(AliasMapping())


class Update(BaseQuery):

    def __init__(self, exprs, where=None, returning=[]):
        super(Update, self).__init__()
        self._exprs = exprs
        self._where = where
        self._returning = returning
        # The main table is the left leaf's table
        self._main = exprs[0]._row
        # Auxiliary tables found in set expressions
        self._rows = [expr._val._row for expr in exprs if isinstance(expr._val, Column)]

    def _pre_build(self, alias_mapping):
        return "UPDATE %s %s" % (self._main._table, alias_mapping[self._main])

    def _build_base(self, alias_mapping):
        sql = [self._pre_build(alias_mapping), "SET"]
        args = []

        _set = []
        for expr in self._exprs:
            _sql, _args = expr._to_sql(alias_mapping)
            _set.append(_sql)
            args += _args

        _set = ', '.join(_set)
        sql.append(_set)
        self.sql.append(' '.join(sql))
        self.args += args


class Insert(BaseQuery):

    def __init__(self, row, vals, do_nothing=False, returning=[]):
        super(Insert, self).__init__()
        self._row = row
        self._vals = vals
        self._do_nothing = do_nothing
        self._returning = returning

    def _pre_build(self, alias_mapping):
        return """INSERT INTO %s""" % self._row._to_sql(alias_mapping, with_cols=True)

    def _build_base(self, alias_mapping):
        self.sql.append(self._pre_build(alias_mapping))
        args = []
        sql = "VALUES %s"

        if any([isinstance(x, QueryExpression) for x in self._vals]):
            assert len(self._vals) == 1, "Only one sub-query per INSERT statement allowed."
            _sql, _args = self._vals[0]._to_sql(alias_mapping)
            sql = ("(%s)" % _sql)
            self.args += _args
            self.sql.append(sql)
            return

        values = []
        for val in self._vals:
            if val is NULL or val is DEFAULT:
                values.append(val)
            else:
                values.append("%s")
                args.append(val)

        sql %= ("(%s)" % ', '.join(map(str, values)))
        self.sql.append(sql)
        self.args += args

    def _build_do(self, alias_mapping):
        if self._do_nothing:
            self.sql.append("ON CONFLICT DO NOTHING")

    def _build_returning(self, alias_mapping):
        alias_mapping[self._row] = self._row._table
        super(Insert, self)._build_returning(alias_mapping)


# SQL Constants
class Constant(object):

    def __init__(self, sql):
        self.sql = sql

    def __str__(self):
        return self.sql


NULL = Constant('NULL')
DEFAULT = Constant('DEFAULT')


# SQL Functions and Aggregates
class Func(Expression):

    __slots__ = ('func', 'args')

    def __init__(self, func, *args):
        """
        Generic PostgreSQL Aggregate/Function, accepts any amount of arguments.

        Args:
            func (str): Name of the function
            args: The function's arguments
        """
        self.func = func
        self.args = args

    def _to_sql(self, alias_mapping):
        sql = '(%s(' % self.func
        args = []

        for arg in self.args:
            if isinstance(arg, Expression):
                _sql, _args = arg._to_sql(alias_mapping)
                sql += _sql
                args += _args
            else:
                args.append(arg)
                sql += '%s'
            if arg is not self.args[-1]:
                sql += ', '

        sql += '))'
        return (sql, args)


class Unnest(Func):

    def __init__(self, *args):
        super(Unnest, self).__init__('UNNEST', *args)
        self._row = (Row(self.func), args)
        self._row[0]._table += "(%s)"


AVG = partial(Func, 'AVG')
COUNT = partial(Func, 'COUNT')
SUM = partial(Func, 'SUM')
MAX = partial(Func, 'MAX')
MIN = partial(Func, 'MIN')
COALESCE = partial(Func, 'COALESCE')
NULLIF = partial(Func, 'NULLIF')
CONCAT = partial(Func, 'CONCAT')
NOW = partial(Func, 'NOW')
EXISTS = partial(Func, 'EXISTS')
ANY = partial(Func, 'ANY')
UNNEST = Unnest
