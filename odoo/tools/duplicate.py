from collections import deque
from contextlib import contextmanager
from datetime import datetime
from dateutil.relativedelta import relativedelta
import logging
from odoo.tools.sql import SQL

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
    'get_random_sring': random_alphabetic_string,
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


class DuplicationGraph:
    """ Undirected Acyclic Graph that represents x2 many FK links between models/relations.
    Used to retrieve the order of tables to duplicate in a database with regard to a root model.

    A delegation relation is handled by adding a parent node for the delegated model.
    """

    __slots__ = ('root', 'isModel', 'parents', 'children', 'annotations')

    def __init__(self, root, isModel=True):
        self.root = root
        self.parents = []
        self.children = []
        self.isModel = isModel  # Whether the current node is a model or a relation.
        self.annotations = {}  # Additional information regarding the current node that is used during the duplication process.

    def __repr__(self):
        # Truncated view of the Graph. self.parents and parents of self.children that are not in self.children are not shown.
        return f"DuplicationGraph(root={self.root!r}, {self.children!r})"

    def __eq__(self, other):
        return self.root == other.root

    def __hash__(self):
        return hash(self.root)

    def __contains__(self, other_node):
        return any(node == other_node for node in self.traverse_graph())

    def _add_child(self, child):
        self.children.append(child)
        child.parents.append(self)

    def _clear(self):
        # Clear self's node parent/child relations
        # Remove node from parents' children
        for parent in self.parents:
            parent.children.remove(self)
        # Remove node from children's parents
        for child in self.children:
            child.parents.remove(self)
        # Clear node relations
        self.parents.clear()
        self.children.clear()

    def set_annotation_value(self, annotation_name, value):
        self.annotations[annotation_name] = value

    def propagate_annotation_to_children(self, annotation_name='', **kwargs):
        """ Propagate annotation info to children.
        When annotation_name is empty, treat kwargs as a dict of annotation_name->value to add to the children.
        When annotation_name is set, treat kwargs as the value for the related annotation.
        """
        for child in self.children:
            if not annotation_name:
                for k, v in kwargs.items():
                    child.set_annotation_value(k, v)
            else:
                child.set_annotation_value(annotation_name, kwargs)

    def traverse_graph(self):
        """ Traverse the graph by yielding the current node only if all its parents have been yielded.
        """
        nodes_to_visit = deque([self])
        seen = set()
        while nodes_to_visit:
            # Peek at top node
            node = nodes_to_visit[0]
            # Mark node as seen
            seen.add(node)
            if all(parent in seen for parent in node.parents):
                # remove node from queue
                nodes_to_visit.popleft()
                yield node
                for child in node.children:
                    if child not in seen:
                        nodes_to_visit.append(child)
            else:
                # Add not seen parents to the beginning of the queue in reverse order, to emulate left-right traversing.
                for parent in node.parents[::-1]:
                    if parent not in seen:
                        nodes_to_visit.appendleft(parent)

    def merge_graph(self, graph_to_merge):
        """ Tries to merge two duplications graphs.
            - If graphs have overlapping fk-links, merge them using the first overlapping key.
            - Otherwise do nothing.

            :return boolean: True if the graphs where merged. False otherwise.
        """
        graph_merged = False
        for base_node in self.traverse_graph():
            for node_to_merge in graph_to_merge.traverse_graph():
                if base_node == node_to_merge:
                    for parent in node_to_merge.parents:
                        parent.children.insert(0, base_node)
                        base_node.parents.append(parent)
                    for annotation_key in node_to_merge.annotations:
                        base_node.annotations.setdefault(annotation_key, node_to_merge.annotations[annotation_key])
                    node_to_merge._clear()
                    break
            else:
                continue
            break
        return graph_merged

    @classmethod
    def build_graph(cls, env, model_name, isModel=True, seen=set()):
        graph = cls(model_name, isModel)
        # When model_name is a relation name, returns the single node tree.
        if not isModel:
            return graph
        model = env[model_name]
        seen.add(model_name)
        to_visit = []
        for field in model._fields.values():
            if field.copy and ((field.store and field.type in ('one2many', 'many2many')) or field.inherited):
                to_visit_model_name = getattr(field.inherited_field, 'model_name', None) or getattr(field, 'relation', None) or field.comodel_name
                if to_visit_model_name not in seen:
                    seen.add(to_visit_model_name)
                    to_visit.append(field)
        # First build model_name's subtree following x2many relationship then build parent tree for inherited fields.
        for field in sorted(to_visit, key=lambda f: f.inherited):
            if field.type == 'one2many':
                graph._add_child(cls.build_graph(env, field.comodel_name, seen=seen))
                graph.children[-1].set_annotation_value(field.inverse_name, {'model': field.model_name})
            elif field.type == 'many2many':
                graph._add_child(cls.build_graph(env, field.relation, False, seen))
                graph.children[-1].set_annotation_value(field.column1, {'model': field.model_name})
            else:
                cls.build_graph(env, field.inherited_field.model_name, seen=seen)._add_child(graph)
                graph.set_annotation_value(field.related.split('.')[0], {'model': field.model_name})
        return graph

@contextmanager
def prepare_table_for_duplicate(env, tablename):
    """ Various optimization to speedup mass duplication of rows in postgresql for the current
    execute call. These optimizations are then reverted when exiting the context.
    """
    # Set session_replication_role to replica for the current transaction to turn off FKs constrains checks.
    env.cr.execute('''SET LOCAL session_replication_role TO replica''')
    # Get and drop existing indexes, pkey and unique indexes excepted, to speedup mass INSERT.
    env.cr.execute('''
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename=%s
            and indexname !~ 'pkey$'
            and indexdef !~~ '%%UNIQUE%%'
        ''', [tablename])
    indexnames, indexdefs = zip(*data) if (data := env.cr.fetchall()) else ([], [])
    if indexnames:
        _logger.info('Dropping indexes on table %s...', tablename)
        env.cr.execute(SQL(';').join(SQL('''DROP INDEX %s CASCADE''', SQL.identifier(indexname)) for indexname in indexnames))
    yield
    if indexnames:
        _logger.info('Adding indexes back on table %s...', tablename)
        env.cr.execute(';'.join(indexdefs))
    env.cr.execute('''SET LOCAL session_replication_role TO origin''')

def create_offset_tables_and_annotate_graph(env, duplication_graph, factors):
    for node in duplication_graph.traverse_graph():
        # Setup scaling factor
        factor_value = node.annotations.get('factor') or factors.get(node.root)
        node.set_annotation_value('factor', factor_value)
        node.propagate_annotation_to_children(factor=factor_value)
        fk_spec = {}
        if node.isModel:
            model = env[node.root]
            tablename = model._table
            env.cr.execute(f'''
            CREATE TEMP TABLE IF NOT EXISTS offset_{tablename} ON COMMIT DROP AS
            SELECT id, row_number() OVER(ORDER BY id asc) as fk_offset
            FROM {tablename};
            CREATE INDEX IF NOT EXISTS offset_{tablename}_id_index ON offset_{tablename}(id);
            ''')
            fk_spec['comodel_offset_table'] = f"offset_{tablename}"
            fk_spec['comodel_table_size'] = model.search_count([])
            fk_spec['comodel_previous_max_id'] = model.search([], order='id desc', limit=1).id
            node.propagate_annotation_to_children(node.root, **fk_spec)

def check_field_need_variation(env, field):
    """ Heuristic returning whether a field needs variation.
    """
    model = env[field.model_name]
    # Fields used in _rec_names_search need variation for SearchViews
    if model._rec_names_search and field.name in model._rec_names_search:
        return True
    # Date/Datetime fields are spread evenly to avoid having all records on the same day.
    if field.type in ('date', 'datetime'):
        return True
    # Trigram-indexed fields need variation to be hit by pattern matching queries.
    indexes_cte = '''
        WITH indexes_cte AS (
            SELECT
                indrelid as rel_oid,
                indclass.relname as indclass_relname,
                pi.indkey as indkey,
                pi.indisunique as indisunique
            FROM pg_index pi
            JOIN pg_class indclass ON pi.indexrelid = indclass.oid
            JOIN pg_am ON indclass.relam = pg_am.oid
            WHERE indclass.relnamespace = 'public'::regnamespace
                AND pi.indrelid::regclass::text = %s
                AND {index_type_clause}
        )
    '''
    env.cr.execute(
        indexes_cte.format(index_type_clause="pg_am.amname = 'gin'")
        +
        '''
        -- Check if field.name is one of the columns of a gin index.
        SELECT 1
        FROM indexes_cte
        JOIN pg_attribute pg_att ON pg_att.attrelid = indexes_cte.rel_oid
        WHERE pg_att.attnum IN (SELECT UNNEST(indexes_cte.indkey))
            AND pg_att.attname = %s
        UNION ALL
        -- Check if field.name is used in an expression of a gin index. E.g. GIN(unaccent(field.name))
        SELECT 1
        FROM indexes_cte
        JOIN pg_indexes ON pg_indexes.indexname = indexes_cte.indclass_relname
            AND pg_indexes.indexdef ilike %s
        ''', [model._table, field.name, f"%({field.name}%)%"])
    # This returns True even if pg_trgm is not installed to be consistent in the varied fields for a given model.
    if field.index == 'trigram' or env.cr.fetchall():
        return True
    # Fields used in a Unique Index need variation to avoid breaking the unique constraint. Only for non-fk fields.
    env.cr.execute(
        indexes_cte.format(index_type_clause="TRUE")
        +
        '''
        SELECT 1
        FROM indexes_cte
        JOIN pg_attribute pg_att ON pg_att.attrelid = indexes_cte.rel_oid
        WHERE pg_att.attnum IN (SELECT UNNEST(indexes_cte.indkey))
            AND pg_att.attname = %s
            AND indexes_cte.indisunique = TRUE
        ''', [model._table, field.name]
    )
    return bool(env.cr.fetchall() and not field.relational)

def _build_query(env, tablename, fields_spec, non_copy_defaults, current_node, duplication_number):
    # TODO check sql injections.
    insert_columns = []
    select_columns = []
    subselect_columns = []
    join_clauses = []

    def add_column_for_mandatory_field(field, current_node):
        # What am I even writing
        python_format_args = []
        sql_format_args = []
        if field.related and current_node.annotations.get(field.related_field.model_name):
            model_annotations = current_node.annotations[field.related_field.model_name]
            base_id = env[field.related_field.model_name].search([('id', '>', model_annotations['comodel_previous_max_id'])], order='id asc', limit=1).id
            python_format_args.append(f"{base_id}-1 + records.fk_offset_0 + {model_annotations['comodel_table_size']}*(t-1)")
        if field.name == 'name' and field.model_name in ('stock.picking', 'sale.order'):
            base_id = env[field.model_name].search([], order='id desc', limit=1).id
            sql_format_args.append(base_id)
        elif field.name in ('name', 'move_name') and field.model_name in ('account.move', 'account.move.line'):
            base_id = env[field.model_name].search([], order='id desc', limit=1).id
            env.cr.execute(SQL('''SELECT COUNT(*) FROM %s;''', SQL.identifier(env[field.model_name]._table)))
            post_duplication_table_size = env.cr.fetchone()[0] * (duplication_number + 1)
            date_part = get_query_part_date_datetime(env, post_duplication_table_size)
            python_format_args.append(date_part)
            if field.model_name == 'account.move':
                sql_format_args.append(base_id)
        select_columns.append(get_query_part_for_field(env, field, tablename, duplication_number, tuple(python_format_args), tuple(sql_format_args)))

    for field in fields_spec.get('stored_default', []):
        if current_node.isModel and field.name in MANDATORY_FIELDS:
            insert_columns.append(field.name)
            add_column_for_mandatory_field(field, current_node)
        elif field.name in non_copy_defaults:
            insert_columns.append(field.name)
            select_columns.append(env.cr.mogrify('''%s''', [non_copy_defaults[field.name]]).decode())
    for field in fields_spec.get('stored', []):
        field_name = field.name if current_node.isModel else field
        insert_columns.append(field_name)
        # Check if field.name is a relational field to a previously duplicated model
        if field_name in current_node.annotations:
            offset_count = 0
            comodel_name = current_node.annotations[field_name]['model']
            model_annotations = current_node.annotations[comodel_name]
            comodel_offset_table = model_annotations['comodel_offset_table']
            base_id = env[comodel_name].search([('id', '>', model_annotations['comodel_previous_max_id'])], order='id asc', limit=1).id
            select_columns.append(f"{base_id}-1 + records.fk_offset_{offset_count} + {model_annotations['comodel_table_size']}*(t-1)")
            join_clauses.append(f"LEFT JOIN {comodel_offset_table} ON tbl.{field_name}={comodel_offset_table}.id")
            subselect_columns.append(f"{comodel_offset_table}.fk_offset AS fk_offset_{offset_count}")
            offset_count += 1
        elif current_node.isModel and field.name in MANDATORY_FIELDS:
            add_column_for_mandatory_field(field, current_node)
        # Check if field need variation.
        elif current_node.isModel and check_field_need_variation(env, field):
            select_columns.append(get_query_part_for_field(env, field, tablename, duplication_number))
        else:
            select_columns.append(field_name)
    join_clause = '\n'.join(join_clauses)
    # Add id as the first column except for Many2many relations
    if current_node.isModel:
        subselect_columns = ['tbl.id'] + subselect_columns
    query_string = f"""
        INSERT INTO {tablename} ({','.join(insert_columns)})
        SELECT {','.join(select_columns)}
        FROM (
            SELECT {','.join(subselect_columns + insert_columns)}
            FROM {tablename} tbl
            {join_clause}
            ORDER BY 1 asc
        ) records,
        generate_series(1, {duplication_number}) t
    """
    return query_string

def duplicate_model(models, factors):
    """ Create `2^factors` new records using existing records as templates.

    :param: list(BaseModel) models: models to duplicate.
    :param: dict(int) factors: duplication factor by model.
    """
    env = models[0].env

    def get_fields_spec(model):
        fields_spec = {
            name: []
            for name in ['stored', 'stored_default']
        }
        for fname, field in model._fields.items():
            if (field.copy or field.required) and fname != 'id' and field.store and field.column_type:
                fields_spec['stored'].append(field)
            elif not field.copy and field.store and (field.default or field.compute) and field.column_type:
                fields_spec['stored_default'].append(field)
        return fields_spec

    duplication_graphs = []
    for model in models:
        new_graph = DuplicationGraph.build_graph(env, model._name)
        create_offset_tables_and_annotate_graph(env, new_graph, factors)
        for graph in duplication_graphs:
            # Checks if new_graph.root is in graph
            if new_graph not in graph:
                merge_successful = graph.merge_graph(new_graph)
                if merge_successful:
                    break
            else:
                # Model already in an existing graph, no need to process it twice so skip to next model.
                break
        else:
            # Couldn't merge model's graph in any existing one, add it to the list
            duplication_graphs.append(new_graph)

    for duplication_graph in duplication_graphs:
        for node in duplication_graph.traverse_graph():
            duplication_number = (1 << node.annotations['factor']) - 1
            non_copy_defaults = {}
            if not node.isModel:
                tablename = node.root
                field = env['ir.model.fields'].search([('relation_table', '=', node.root)], limit=1)
                fields_spec = {'stored': [field.column1, field.column2]}
            else:
                node_model = env[node.root]
                tablename = node_model._table
                fields_spec = get_fields_spec(node_model)
                # Handle non-copyable fields with default values/computed default values
                new_model = node_model.new()
                non_copy_defaults = {
                    field.name: field.convert_to_column(field.convert_to_write(new_model[field.name], new_model), new_model)
                    for field in fields_spec['stored_default']
                }
            query = _build_query(env, tablename, fields_spec, non_copy_defaults, node, duplication_number)
            with prepare_table_for_duplicate(env, tablename):
                env.cr.execute(query)
        env.registry.duplication_done_for_model[duplication_graph.root] = True
