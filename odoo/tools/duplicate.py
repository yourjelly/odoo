import math
from collections import deque, defaultdict
from contextlib import contextmanager
from datetime import datetime
from dateutil.relativedelta import relativedelta
import logging
from odoo.tools.sql import SQL
from odoo.fields import Many2one

_logger = logging.getLogger(__name__)


##### SQL Variation Functions

# https://www.depesz.com/2017/02/06/generate-short-random-textual-ids/
random_alphabetic_string = '''
    CREATE OR REPLACE FUNCTION get_random_string(
        IN string_length INTEGER,
        IN possible_chars TEXT
        DEFAULT 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
    ) RETURNS text
    LANGUAGE plpgsql
    AS $$
    DECLARE
        output TEXT = '';
        i INT4;
        pos INT4;
    BEGIN
        FOR i IN 1..string_length LOOP
            pos := 1 + CAST( random() * ( LENGTH(possible_chars) - 1) AS INT4 );
            output := output || substr(possible_chars, pos, 1);
        END LOOP;
        RETURN output;
    END;
    $$;
'''

# https://www.postgresqltutorial.com/postgresql-tutorial/postgresql-random-range/
random_integer = '''
    CREATE OR REPLACE FUNCTION get_random_int(low INT, high INT)
    RETURNS INT AS
    $$
    BEGIN
    RETURN floor(random()* (high-low + 1) + low);
    END;
    $$ language 'plpgsql' STRICT;
'''

random_numeric = '''
    CREATE OR REPLACE FUNCTION get_random_numeric(low numeric, high numeric)
    RETURNS NUMERIC AS
    $$
    BEGIN
    RETURN random()::numeric *(high-low) + low;
    END;
    $$ language 'plpgsql' STRICT;
'''

SQL_VARIATION_FUNCTIONS = {
    'get_random_string': random_alphabetic_string,
    'get_random_int': random_integer,
    'get_random_numeric': random_numeric,
}

# Minimum length for a random varchar
MIN_VARCHAR_LENGTH = 4

# Min/Max value for a date/datetime field
MIN_DATETIME = datetime((datetime.now() - relativedelta(years=4)).year, 1, 1)
MAX_DATETIME = datetime.now()
MIN_ROWS_PER_DAY = 1000

##### Mandatory fields

MANDATORY_FIELDS = ['company_id', 'invoice_date_due', 'move_name', 'invoice_date', 'name', 'invoice_date']

NAME_FIELDS_FORMAT = {
    "move_name": {
        "account.move.line": r"""CASE WHEN move_name='/' THEN '/' ELSE regexp_replace(move_name, '(\w+\/).*', '\1') END || EXTRACT('year' FROM {1}) || '/' || CASE WHEN move_name ~ '.*(\/\d\d\/).*' THEN LPAD(EXTRACT('month' FROM {1})::text, 2, '0') || '/' ELSE '' END || {0} END"""
    },
    "name": {
        "account.move": r"""CASE WHEN name='/' THEN '/' ELSE regexp_replace(name, '(\w+\/).*', '\1') || EXTRACT('year' FROM {0}) || '/' || CASE WHEN name ~ '.*(\/\d\d\/).*' THEN LPAD(EXTRACT('month' FROM {0})::text, 2, '0') || '/' ELSE '' END || %s + row_number() OVER() END""",
        "stock.picking": r"""regexp_replace(name, '(.*\/)\d*', '\1') || '0' || (%s + row_number() OVER ())""",
        "sale.order": r"""'S' || %s + row_number() OVER()""",
    },
}

##### Python Variation Functions

def get_query_part_random_int(env, low, high):
    return env.cr.mogrify('''get_random_int(%s, %s)''', [low, high]).decode()

def get_query_part_random_float(env, low, high):
    return env.cr.mogrify('''get_random_numeric(%s, %s)''', [low, high]).decode()

def get_query_part_random_string(env, size, strict=True):
    """
    :param strict: When True, return a query_part for a string of exactly `size` characters.
        When False, return a query_part for a string of at most `size` characters.
    """
    if strict:
        return env.cr.mogrify('''get_random_string(%s)''', [size]).decode()
    return env.cr.mogrify('''get_random_string(get_random_int(%s, %s))''', [MIN_VARCHAR_LENGTH, max(MIN_VARCHAR_LENGTH, size)]).decode()

def get_query_part_date_datetime(env, total_table_size, min_date=MIN_DATETIME, max_date=MAX_DATETIME):
    """
    :param datetime_column: name of the date/timestamp column
    :param total_table_size: total_size of the table after the duplication process.
    """
    if total_table_size <= MIN_ROWS_PER_DAY:
        return '''now()::timestamp'''
    total_days = (max_date - min_date).days
    rows_per_day = max(MIN_ROWS_PER_DAY, total_table_size // total_days + 1)
    if total_table_size <= MIN_ROWS_PER_DAY * total_days:
        min_date = min_date + relativedelta(days=(total_days - total_table_size // MIN_ROWS_PER_DAY))
    return env.cr.mogrify('''%s + (row_number() OVER()/%s) * interval '1 day' ''', [min_date, rows_per_day]).decode()

def get_query_part_formatted_string(env, format_part, python_format_args, sql_format_args):
    query_string = format_part.format(*python_format_args)
    return env.cr.mogrify(query_string, sql_format_args).decode()

# TODO find better abstraction for this part.
def get_query_part_for_field(env, field, tablename, duplication_number, python_format_args=(), sql_format_args=()):
    if field.name in MANDATORY_FIELDS and NAME_FIELDS_FORMAT.get(field.name, {}).get(field.model_name):
        return get_query_part_formatted_string(env, NAME_FIELDS_FORMAT[field.name][field.model_name], python_format_args, sql_format_args)
    if field.name in MANDATORY_FIELDS and field.relational:
        return field.name
    if field.column_type[0] in ('date', 'timestamp'):
        env.cr.execute(SQL('''SELECT COUNT(*) FROM %s;''', SQL.identifier(tablename)))
        post_duplication_table_size = env.cr.fetchone()[0] * (duplication_number + 1)
        return get_query_part_date_datetime(env, post_duplication_table_size)
    if field.column_type[0] in ('numeric', 'float8'):
        return get_query_part_random_float(env, 1.0, 50.0)
    if field.column_type[0] == 'int4':
        return get_query_part_random_int(env, 1, 100)
    if field.column_type[0] == 'varchar':
        return get_query_part_random_string(env, 10, strict=False)
    # If no variation function for this column_type, return field as is
    return f"{field.name}"


@contextmanager
def ignore_indexes(env, tablename):
    """
    Temporarily drop indexes on table to speed up insertion.
    PKey and Unique indexes are kept for constraints
    """
    indexes = env.execute_query_dict(SQL("""
        SELECT indexname AS name, indexdef AS definition
          FROM pg_indexes
         WHERE tablename = %s
           AND indexname NOT LIKE %s
           AND indexdef NOT LIKE %s
    """, tablename, '%pkey', '%UNIQUE%'))
    if indexes:
        _logger.info('Dropping indexes on table %s...', tablename)
        env.cr.execute(SQL(';').join(
            SQL('DROP INDEX %s CASCADE', SQL.identifier(index['name']))
            for index in indexes
        ))
        yield
        _logger.info('Adding indexes back on table %s...', tablename)
        env.cr.execute(';'.join(index['definition'] for index in indexes))
    else:
        yield


@contextmanager
def ignore_fkey_constraints(env):
    """
    Disable Fkey constraints checks by setting the session to replica.
    """
    env.cr.execute('SET session_replication_role TO replica')
    yield
    env.cr.execute('RESET session_replication_role')


# TODO: unlogged tables context


def field_need_variation(env, model, field):
    """
    Return True/False depending on if the field needs to be varied.
    Might be necessary in the case of:
    - unique constraints
    - varying dates for better distribution
    - field will be part of _rec_name_search, therefor variety is needed for effective searches
    - field has a trigram index on it
    """
    def is_unique(_env, _model, _field):
        """
        An unique constraint is enforced by Postgres as an unique index,
        whether it's defined as a constraint on the table, or as an manual unique index.
        Both type of constraint are present in the index catalog
        """
        query = SQL("""
        SELECT EXISTS(SELECT 1
              FROM pg_index idx
                   JOIN pg_class t ON t.oid = idx.indrelid
                   JOIN pg_class i ON i.oid = idx.indexrelid
                   JOIN pg_attribute a ON a.attnum = ANY (idx.indkey) AND a.attrelid = t.oid
              WHERE t.relname = %s  -- tablename
                AND a.attname = %s  -- column
                AND idx.indisunique = TRUE) AS is_unique;
        """, _model._table, _field.name)
        return _env.execute_query(query)[0][0]

    if is_unique(env, model, field):
        return True
    # TODO: vary dates
    # TODO: vary str when part of _rec_name_search
    # TODO: vary str when part of a trigram index
    return False


def variate_field(env, model, field, table_alias, series_alias):
    """
    Returns a variation of the source field,
    to avoid unique constraint, or better distribute data.

    :return: a str representing the source column, or an SQL(expression/subquery)
    """
    match field.type:
        case 'char':
            # we presume that 16 chars is enough to avoid collisions
            # TODO: FP wants to just append the series number for all chars, it will also handle unique violation constraints
            #  Dev note for ^: this suggestion is going to render any trigram search extremely slow (too much repetition)
            size = min(field.size if field.size else math.inf, 16)
            str_variation_query = SQL(f'get_random_string({size})')
            # if the field is translatable, it's a JSONB column, we vary all values for each key
            if field.translate:
                return SQL("""
                    CASE
                        WHEN %(field_column)s IS NOT NULL THEN (
                            SELECT jsonb_object_agg(key, %(str_vary_expr)s)
                            FROM jsonb_each(%(field_column)s)
                        )
                        ELSE NULL
                    END
                """, field_column=SQL.identifier(field.name), str_vary_expr=str_variation_query)
            return str_variation_query
        case 'integer' | 'float' | 'numeric':
            return SQL('get_random_int(0, 10000)')
        case 'many2one':
            # select an id from the comodel's table that isn't used by the Many2one,
            # if all are used, we pick a random one.
            comodel = env[field.comodel_name]
            different_fkey_query = SQL('(%s)', SQL("""
                SELECT id
                FROM %(comodel)s AS comodel
                WHERE NOT EXISTS (
                    SELECT 1 FROM %(model)s AS model WHERE model.%(fkey)s = comodel.id
                )
                ORDER BY RANDOM()
                LIMIT 1
            """, comodel=SQL.identifier(comodel._table), model=SQL.identifier(model._table), fkey=SQL.identifier(field.name)))
            random_fkey_query = SQL('(%s)', SQL("""
                SELECT id FROM %(comodel)s ORDER BY RANDOM() LIMIT 1
            """, comodel=SQL.identifier(comodel._table)))
            return SQL('(%s)', SQL('SELECT COALESCE(%s, %s)', different_fkey_query, random_fkey_query))
        case 'selection':
            return SQL('(%s)', SQL("""
                SELECT %(field)s FROM %(model)s GROUP BY %(field)s ORDER BY RANDOM() LIMIT 1
            """, field=SQL.identifier(field.name), model=SQL.identifier(model._table)))
        # TODO: handle other types as necessary
        case _:
            raise RuntimeError(
                f"Unreachable code, the field {field} was marked to be varied,"
                f" but no variation branch was found."
            )


def fetch_last_id(env, model):
    query = SQL('SELECT id FROM %s ORDER BY id DESC LIMIT 1', SQL.identifier(model._table))
    return env.execute_query(query)[0][0]


def duplicate_field(env, model, field, duplicated, factors, table_alias='t', series_alias='s'):
    """
    Returns a tuple representing the destination and the source expression (str column or SQL expression)
    """
    def copy_noop():
        return None, None

    def copy_raw(_field):
        return _field.name, _field.name

    def copy(_field):
        if field_need_variation(env, model, _field):
            return _field.name, variate_field(env, model, _field, table_alias, series_alias)
        else:
            return copy_raw(_field)

    def copy_id():
        last_id = fetch_last_id(env, model)
        duplicated[model] = last_id  # this adds the model in the duplicated dict
        return field.name, SQL(f'id + {last_id} * {series_alias}')

    def copy_many2one(_field):
        # if the comodel was priorly duplicated, remap the many2one to the new copies
        if (comodel := env[_field.comodel_name]) in duplicated:
            comodel_max_id = duplicated[comodel]
            # we use MOD() instead of %, because % cannot be correctly escaped, it's a limitation of the SQL wrapper
            return _field.name, SQL(f"{table_alias}.{_field.name} + {comodel_max_id} * (MOD({series_alias} - 1, {factors[model]}) + 1)")
        return copy(_field)

    def copy_related_store(_field):
        # TODO: for some related store field, we want to copy the raw value from the table (ex: company_id on sale.order.line),
        #  but for others (ex: sale_id on stock.picking) we would like the value to follow the *new* value that is inserted.
        #  One need to reference values from the same row that is being inserted.
        #  Also a hook needs to be exposed so modules can decide if they follow the relation or not.
        #  For now, we regularly copy the field.
        follow_m2o = False  # TODO: this should be a customizable hook
        if follow_m2o:
            has_column = lambda f: f.store and f.column_type
            linking_field = model._fields[_field.related.split('.')[0]]
            linking_model = env[linking_field.comodel_name]
            if linking_model in duplicated and has_column(linking_field) and has_column(_field.related_field):
                # we know that linking_model is in duplicated -> we get the SQL expr for the m2o remapping
                _, m2o_sql_expr = copy_many2one(linking_field)
                return _field.name, SQL('(%s)', SQL(f"""
                    SELECT %(related_field)s
                    FROM %(linking_model)s
                    WHERE id = %(m2o_sql_expr)s
                """, related_field=SQL.identifier(_field.related_field.name),
                     linking_model=SQL.identifier(linking_model._table),
                     linking_field=SQL.identifier(linking_field.name),
                     m2o_sql_expr=m2o_sql_expr))
        return copy(_field)

    if field.name == 'id':
        return copy_id()
    if field.related and field.store:
        return copy_related_store(field)
    match field.type:
        case 'one2many':
            # there is nothing to copy, as it's value is implicitly read from the inverse Many2one
            return copy_noop()
        case 'many2many':
            # there is nothing to do, the copying of the m2m will be handled when copying the relation table
            return copy_noop()
        case 'many2one':
            return copy_many2one(field)
        case 'many2one_reference':
            # TODO: in the case of a reference field, there is no comodel,
            #  but it's specified as the value of the field specified by model_field.
            #  Not really sure how to handle this, as it involves reading the content pointed by model_field
            #  to check on-the-fly if it's duplicated or not python-side, so for now we raw-copy it.
            #  If we need to read on-the-fly, the duplicated structure needs to be in DB (via a new Model?)
            return copy(field)
        case 'binary':
            # copy only binary field that are inlined in the table
            return copy(field) if not field.attachment else copy_noop()
        case _:
            return copy(field)


def duplicate_model(env, model, duplicated, factors):

    def update_sequence(_model):
        env.execute_query(SQL(f"SELECT SETVAL('{_model._table}_id_seq', {fetch_last_id(env, _model)}, TRUE)"))

    assert model not in duplicated, f"We do not duplicate a model ({model}) that has already been duplicated."
    _logger.info('Duplicating model %s...', model._name)
    dest_fields = []
    src_fields = []
    table_alias = 't'
    series_alias = 's'
    # process all stored fields (that has a respective column), if the model has an 'id', it's processed first
    has_column = lambda f: f.store and f.column_type
    for field in (f for f in sorted(model._fields.values(), key=lambda x: x.name != 'id') if has_column(f)):
        dest, src = duplicate_field(env, model, field, duplicated, factors, table_alias, series_alias)
        dest_fields += [dest if isinstance(dest, SQL) else SQL.identifier(dest)] if dest else []
        src_fields += [src if isinstance(src, SQL) else SQL.identifier(src)] if src else []
    # TODO: when done with development, uncomment the `ON CONFLICT DO NOTHING`
    query = SQL(f"""
        INSERT INTO %(table)s (%(dest_columns)s)
        SELECT %(src_columns)s FROM %(table)s {table_alias},
        GENERATE_SERIES(1, {factors[model]}) {series_alias}
--         ON CONFLICT DO NOTHING
    """, table=SQL.identifier(model._table),
         dest_columns=SQL(', ').join(dest_fields),
         src_columns=SQL(', ').join(src_fields))
    env.cr.execute(query)
    # normally copying the 'id' will set the model entry in the duplicated dict,
    # but for the case of a table with no 'id' (ex: Many2many), we add manually,
    # by reading the key and having the defaultdict do the insertion, with a default value of 0
    if duplicated[model]:
        # in case we duplicated a model with an 'id', we update the sequence
        update_sequence(model)


def infer_many2many_model(env, field):
    """
    Returns the relation model used for the m2m:
    - If it's a custom model, return the model
    - If it's an implicite table generated by the ORM,
      return a wrapped model that behaves like a fake duck-typed model for the duplication algorithm
    """

    class Many2oneFieldWrapper(Many2one):
        def __init__(self, model, field_name, comodel_name):
            super().__init__(comodel_name)
            self._setup_attrs(model, field_name)  # setup most of the default attrs

    class Many2manyModelWrapper:
        def __init__(self, field):
            self._name = field.relation  # a m2m doesn't have a _name, so we use the tablename
            self._table = field.relation
            self._inherits = {}
            self.env = env
            # if the field is inherited, the column attributes are defined on the base_field
            column1 = field.column1 if field.column1 else field.base_field.column1
            column2 = field.column2 if field.column2 else field.base_field.column2
            # column1 refers to the model, while column2 refers to the comodel
            self._fields = {
                field.column1: Many2oneFieldWrapper(self, column1, field.model_name),
                field.column2: Many2oneFieldWrapper(self, column2, field.comodel_name),
            }

        def __repr__(self):
            return self._name

        def __eq__(self, other):
            return self._name == other._name

        def __hash__(self):
            return hash(self._name)

    # check if the relation is an existing model
    if model := next((model for model in env.registry.models.values() if model._table == field.relation), None):
        return env[model._name]  # `model` is a MetaModel, re-fetch from env to get the actual ORM model
    # the relation is a relational table, return a wrapped version
    return Many2manyModelWrapper(field)

# list of tables to not duplicate
DUPLICATE_BLACKLIST_TABLES = {
    # Due to the unique constraint `attribute_value_unique`, and both Fkey are required,
    # we don't have enough combinations from the base set of ids to generate all unique pairs.
    'product_template_attribute_value',  # TODO: remove when done developing, as it's case is handled by the ON CONFLICT DO NOTHING during INSERT
    # TODO: do we add to the blacklist tables like ir_ui_view/ir_ui_menu and others of the same genre?
    'ir_ui_view',
    'ir_ui_menu',
    'ir_rule',
    'res_groups',
    'res_groups_users_rel',
    # when duplicating only stock.picking, (cid, user_id) pkey is not unique
    'res_company_users_rel', # TODO: remove when done developing, as it's case is handled by the ON CONFLICT DO NOTHING during INSERT
    # `name` of the currency is only 3 char long and there is an unique constraint on it, no point in duplicating
    'res_currency',
    'res_country',
    'res_country_state',
}

def duplicate_models(env, models, factors):
    """
    Create `2^factors` new records using existing records as templates.

    If a dependency is found for a specific model, but it isn't specified by the user,
    it will inherit the factor of the dependant model.

    :param: list(BaseModel) models: models to duplicate.
    :param: dict(int) factors: duplication factor by model.
    """

    def has_records(_model):
        query = SQL('SELECT EXISTS (SELECT 1 FROM %s)', SQL.identifier(_model._table))
        return _model.env.execute_query(query)[0][0]

    def is_blacklisted(_model):
        return _model._table in DUPLICATE_BLACKLIST_TABLES

    to_process = deque(models)
    duplicated = defaultdict(int)  # {model: int(old_max_id)}
    while to_process:
        model = to_process.popleft()
        if is_blacklisted(model):
            continue
        if not has_records(model):  # if there are no records, there is nothing to duplicate
            continue
        # if the model has _inherits, the delegated models need to have been duplicated before the current one
        missing_dependencies = [m for model_name in model._inherits if (m := env[model_name]) not in duplicated]
        if missing_dependencies:
            pending_dependencies = [dep for dep in missing_dependencies if dep not in to_process]
            if pending_dependencies:
                to_process.extendleft([model] + pending_dependencies)
                factors.update({dep: factors[model] for dep in pending_dependencies})
                continue
        # if there is a related stored field, the related model should be duplicated before the current one
        related_store_fields = [f for f in model._fields.values() if f.related and f.store]
        if related_store_fields:
            missing_dependencies = [m for f in related_store_fields if f.comodel_name and (m := env[f.comodel_name]) not in duplicated]
            if missing_dependencies:
                # the check with `has_records` is to avoid infinite loops when one of the cyclic dependencies has no records to be copied
                # the check on the blacklist is to avoid an infinite loop, because the dependency will never be duplicated, as it's blacklisted
                pending_dependencies = [dep for dep in missing_dependencies if dep not in to_process and has_records(dep) and not is_blacklisted(dep)]
                if pending_dependencies:
                    to_process.extendleft([model] + pending_dependencies)
                    factors.update({dep: factors[model] for dep in pending_dependencies})
                    continue
        # models on the other end of X2many relation should also be duplicated (ex: to avoid SO with no SOL)
        for field in (f for f in model._fields.values() if f.store and f.copy):
            match field.type:
                case 'one2many':
                    comodel = env[field.comodel_name]
                    if comodel != model and comodel not in duplicated and comodel not in to_process:
                        to_process.append(comodel)
                        factors[comodel] = factors[model]
                case 'many2many':
                    # duplicate first the comodel of the m2m, then the relation table/model linking the two
                    comodel = env[field.comodel_name]
                    if comodel != model and comodel not in duplicated and comodel not in to_process:
                        to_process.append(comodel)
                        factors[comodel] = factors[model]
                    m2m_model = infer_many2many_model(env, field)
                    if m2m_model not in duplicated and m2m_model not in to_process:
                        to_process.append(m2m_model)
                        factors[m2m_model] = factors[model]
                case _:
                    continue
        with ignore_fkey_constraints(env), ignore_indexes(env, model._table):
            duplicate_model(env, model, duplicated, factors)
