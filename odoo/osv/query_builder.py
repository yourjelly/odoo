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

from collections import Iterable
from functools import partial
from numbers import Number

from odoo.tools.pycompat import text_type


def _quote(val):
    """ Helper function for quoting SQL identifiers. """
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

    def _to_sql(self, alias_dict):
        """
        Generates SQL statements and expressions from the current object.

        Returns:
            A tuple containing an SQL string and a list of arguments to be interpolated into
            the string, to be fed directly into cr.execute()
        """
        # TODO: Optimize parentheses generation
        left, args = self.left._to_sql(alias_dict)

        if self.op == 'NOT':
            return ("(NOT %s)" % left, args)

        sql = "(%s %s " % (left, self.op)

        if isinstance(self.right, Expression):
            right, _args = self.right._to_sql(alias_dict)

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


class AliasMapping(dict):

    def __init__(self, *args, **kwargs):
        super(AliasMapping, self).__init__()
        self._generator = generate_aliases()

    def __missing__(self, k):
        alias = _quote(next(self._generator))
        self[k] = alias
        return alias


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

    def _to_sql(self, alias_dict):
        sql = '(%s(' % self.func
        args = []

        for arg in self.args:
            if isinstance(arg, Expression):
                _sql, _args = arg._to_sql(alias_dict)
                sql += _sql
                args += _args
            else:
                args.append(arg)
                sql += '%s'
            if arg is not self.args[-1]:
                sql += ', '

        sql += '))'
        return (sql, args)


class QueryExpression(Expression):

    __slots__ = ('op', 'left', 'right')

    """ Class for operators between Select objects """

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


class Column(Expression):

    __slots__ = ('_row', '_name')

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

    def _to_sql(self, alias_dict=None):
        qualified = "{alias}.%s" % self._name
        row = self._row
        if alias_dict is not None:
            return (qualified.format(**{'alias': alias_dict[row]}), [])
        return (qualified.format(**{'alias': row._table}), [])


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

    def _to_sql(self, alias_dict):
        sql, args = self.expression._to_sql(alias_dict)
        return (" %s %s %s ON %s" % (self.type, self.t2._table, alias_dict[self.t2], sql),
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

    def _to_sql(self, alias_dict):
        sql = self.column._to_sql(alias_dict)[0]
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


class Select(QueryExpression):

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
        self._tables = self._get_tables()

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

    # Helper methods for building the final query
    def _build_joins(self, alias_dict):
        sql = []
        args = []

        for join in self._joins:
            _sql, _args = join._to_sql(alias_dict)
            sql.append(_sql)
            args += _args

        return (''.join(sql), args)

    def _build_columns(self, alias_dict):
        res = []

        for c in self._columns:
            if isinstance(c, Row):
                sql = "*"
            elif self._aliased:
                col = self._columns[c]
                sql = "%s AS %s" % (col._to_sql(alias_dict)[0], c)
            else:
                sql = "%s" % c._to_sql(alias_dict)[0]
            res.append(sql)

        return ', '.join(res)

    def _build_tables(self, alias_dict):
        return ', '.join(["%s %s" % (t._table, alias_dict[t]) for t in self._tables])

    def _build_where(self, alias_dict):
        sql = " WHERE %s"
        if self._where:
            where, args = self._where._to_sql(alias_dict)
            return sql % where, args
        return '', []

    def _build_order(self, alias_dict):
        if self._order:
            sql = " ORDER BY %s"
            return sql % ', '.join([o._to_sql(alias_dict)[0] for o in self._order])
        return ''

    def _build_group(self, alias_dict):
        if self._group:
            sql = " GROUP BY %s"
            return sql % ', '.join([g._to_sql(alias_dict)[0] for g in self._group])
        return ''

    def _build_having(self, alias_dict):
        sql = " HAVING %s"
        if self._having:
            having, args = self._having._to_sql(alias_dict)
            return sql % having, args
        return '', []

    def _build_limit(self):
        if self._limit:
            sql = " LIMIT %s OFFSET %s"
            return sql, [self._limit, self._offset]
        return '', []

    def _to_sql(self, alias_dict):
        sql = "SELECT %s%s FROM %s" % (
            'DISTINCT ' if self._distinct else '', self._build_columns(alias_dict),
            self._build_tables(alias_dict)
        )
        args = []

        def with_args(f, uses_alias_dict=True):
            # access parent f(x)'s query and args and modify them
            nonlocal sql, args, alias_dict
            _sql, _args = f(alias_dict) if uses_alias_dict else f()
            sql += "%s" % _sql
            args += _args

        with_args(self._build_joins)
        with_args(self._build_where)

        sql += self._build_order(alias_dict)
        sql += self._build_group(alias_dict)

        with_args(self._build_having)
        with_args(self._build_limit, False)

        return (sql, args)

    def to_sql(self):
        return self._to_sql(AliasMapping())


class Delete(object):

    def __init__(self, rows, using=[], where=None, returning=[]):
        """
        Stateless class for generating SQL DELETE statements.

        Args:
            rows: Either a List of Row instances of the tables from which records will be deleted
                or a Dict in the form of {alias: row}.
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
        self._rows = rows
        self._using = using
        self._where = where
        self._returning = returning

    def _build_from(self, alias_mapping):
        return "DELETE FROM %s" % ", ".join(
            ["%s %s" % (r._table, alias_mapping[r]) for r in self._rows]
        )

    def _to_sql(self, alias_mapping):
        sql = ""
        args = []

        sql += self._build_from(alias_mapping)
        return sql, args

    def to_sql(self):
        return self._to_sql(AliasMapping())


# SQL Functions and Aggregates
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
UNNEST = partial(Func, 'UNNEST')
