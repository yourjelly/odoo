from psycopg2 import sql

"""
These set of utils is meant to be used within the odoo shell environment.
The goal is to count the occurrence of base64-encoded images in html fields.

Usage:

count_all(env)

    Returns as list of (table_name, field_name, count) tuples, and prints
    something like:

        Record count of html fields containing base64-encoded images
        Table                      Field               Record count
        ------------------------------------------------------------
        account_edi_document       error                    0
        account_move               narration                0
        account_move_send          mail_body                0
        ...


get_html_fields(env)

    Returns a list of (table_name, field_name) pairs for html fields found in
    the database.

    This is the list used by count_all().


count(cr, [('project_task', 'description'), ('crm_lead', 'description')])

    Use this to get the record count of specific (table, field) pairs.

    An optional `pattern` argument can be used, see function docstring. 


Obs: with count_all() the same record might end up being counted multiple times
if its model has multiple html fields containing base64-encoded images (the
count is performed field-wise).

"""

def count_all(env):
    """
    Count the occurrence of base64-encoded images in all html fields.

    :return: list of (table_name, field_name, count) for each html field.
    """

    counts = count(env.cr, get_html_fields(env))
    _print_report(counts)
    return counts

def get_html_fields(env):
    """
    :return: list of (table_name, field_name) pairs for html fields.
    """
    html_fields = env['ir.model.fields'].search([
        ('ttype', '=', 'html'),
        ('store', '=', True),
    ])
    models_and_fields = [(env[field.model_id.model], field) for field in html_fields]

    def _field_filter(model_field):
        model, field = model_field
        if model._transient:
            return False
        if not _table_exists(env.cr, model._table):
            return False
        return True

    table_and_field_names = [(model._table, field.name) for model, field in 
                             filter(_field_filter, models_and_fields)]
    table_and_field_names.sort()
    return table_and_field_names

def count(cr, fields, pattern="%src=_data:image/%"):
    """
    Count the occurrence of `pattern` in `fields`.

    :param: cr: database cursor
    :param: fields: list of (table_name, field_name) tuples.
    :param: pattern: a pattern for the LIKE operator.

    An alternative and more specific pattern for base64-encoded images could be:
        "%src=_data:image/%;base64,%"
    It should result in less false-positives, but it's likely to slow down the search.
    """

    print(f"Searched pattern: {pattern}")
    record_counts = []
    for table, field in fields:
        print(f"Counting records for {table} {field}... ", end='', flush=True)
        record_count = _count_records(cr, table, field, pattern)
        print(str(record_count))
        record_counts.append((table, field, record_count))
    return record_counts


def _count_records(cr, table, field, pattern):
    data_type = _data_type(cr, table, field)
    if data_type == 'text':
        query_template = """
            SELECT COUNT(id)
            FROM {table}
            WHERE {field}
            LIKE %s
        """
    elif data_type == 'jsonb':
    # Check first key only.
        query_template = """
            SELECT COUNT(id)
            FROM {table}
            WHERE {field} ->> (SELECT jsonb_object_keys({field}) LIMIT 1)
            LIKE %s
        """
    else:
        return 0

    cr.execute(sql.SQL(query_template).format(
        table=sql.Identifier(table),
        field=sql.Identifier(field),
    ), [pattern])

    return cr.fetchone()[0]

def _table_exists(cr, table_name):
    cr.execute("""
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_name = %s AND table_type = 'BASE TABLE'
        )
    """, [table_name])
    return cr.fetchone()[0]

def _data_type(cr, table, column):
    cr.execute("""
        SELECT data_type
        FROM information_schema.columns
        WHERE table_name = %s
        AND column_name = %s
    """, [table, column])
    result = cr.fetchone()
    if result:
        return result[0]

def _print_report(counts):
    print("\nRecord count of html fields containing base64-encoded images")
    print('-' * 80)
    print(f"{'Table':30} {'Field':30} {'Record count'}")
    print('-' * 80)
    total = 0
    for table, field, count in counts:
        print(f"{table:30} {field:30} {count:>8}")
        total += count
    print(f"{'Total':60}  {total:>8}")
