from odoo import fields, models, Command
from odoo.tools.misc import human_size


class IndexRemove(models.BaseModel):

    _name = 'base.index.remove'
    _description = 'Remove index'

    index_analyze_id = fields.Many2one('base.index.analyze', 'Analyse')
    model_id = fields.Many2one('ir.model')
    human_size = fields.Char('Size')
    name = fields.Char('Index Name')
    description = fields.Text('Description')
    definition = fields.Char('Definition')
    unique = fields.Boolean('Unique')
    confident = fields.Selection([('high', 'High'), ('normal', 'Normal'), ('low', 'Low')])

    def remove_index(self):
        pass


class DuplicateIndex(models.TransientModel):
    _name = 'base.duplicate.index'
    _inherit = 'base.index.remove'
    _description = 'Duplicate index'


class UnusedIndex(models.TransientModel):

    _name = 'base.unused.index'
    _inherit = 'base.index.remove'
    _description = 'Unused index'


class IndexAnalyze(models.TransientModel):

    _name = 'base.index.analyze'
    _description = 'Analyse SQL index to find duplicate and unused ones'

    duplicate_index_ids = fields.One2many('base.duplicate.index', 'index_analyze_id', 'Duplicate Indexes')
    unused_index_ids = fields.One2many('base.unused.index', 'index_analyze_id', 'Unused Indexes')

    def show_unused_index(self):
        self.env.cr.execute("""
            SELECT
                pg_index.indrelid::regclass AS table_name,
                pg_index.indexrelid::regclass AS index_name,
                pg_table_size(pg_index.indexrelid) AS size,
                pg_indexes.indexdef AS definition
            FROM
                pg_stat_user_indexes
                JOIN pg_index ON pg_index.indexrelid = pg_stat_user_indexes.indexrelid
                JOIN pg_indexes ON pg_indexes.indexname::regclass = pg_index.indexrelid::regclass
            WHERE
                idx_scan = 0
                AND NOT indisunique
                AND NOT indisexclusion
            ORDER BY
                pg_table_size(pg_index.indexrelid) DESC
            LIMIT 500
        """)
        unused_indexes = [Command.clear()]
        for table_name, name, size, definition in self.env.cr.fetchall():
            model_name = table_name.replace('_', '.')
            unused_indexes.append(Command.create({
                'model_id': self.env['ir.model']._get_id(model_name),
                'name': name,
                'human_size': human_size(size),
                'unique': False,
                'confident': 'low',
                'definition': definition,
                'description': f'"{name}" ("{definition}") was not used for now, maybe we can remove it ?'
            }))
        self.unused_index_ids = unused_indexes

    def show_duplicate_index(self):
        # See https://www.postgresql.org/docs/10/catalog-pg-index.html
        # and https://www.postgresql.org/docs/10/view-pg-indexes.html
        self.env.cr.execute("""
            SELECT
                indrelid::regclass AS table_name,
                ARRAY_AGG(indexname
                    ORDER BY indisunique DESC, indexrelid) AS names,
                ARRAY_AGG(indisunique
                    ORDER BY indisunique DESC, indexrelid) AS uniques,
                ARRAY_AGG(pg_table_size(indexrelid)
                    ORDER BY indisunique DESC, indexrelid) AS sizes,
                ARRAY_AGG(indexdef
                    ORDER BY indisunique DESC, indexrelid) AS definitions
            FROM
                pg_index
                JOIN pg_indexes ON indexname::regclass = indexrelid::regclass
            GROUP BY
                indrelid,
                indkey,
                indclass,
                indexprs,
                indpred
            HAVING
                COUNT(*) > 1
            ORDER BY
                SUM(pg_table_size(indexrelid)) DESC
        """)
        duplicate_index_vals = [Command.clear()]
        for table_name, names, uniques, sizes, definitions in self.env.cr.fetchall():
            model_name = table_name.replace('_', '.')

            for name, unique, size, definition in zip(names[1:], uniques[1:], sizes[1:], definitions[1:]):
                import logging
                _logger = logging.getLogger(__name__)
                _logger.info(f'- "{name}" covers by "{names[0]}"')
                duplicate_index_vals.append(Command.create({
                    'model_id': self.env['ir.model']._get_id(model_name),
                    'name': name,
                    'human_size': human_size(size),
                    'unique': unique,
                    'confident': 'high',
                    'definition': definition,
                    'description': f'"{name}" ("{definition}") is the same than "{names[0]}" ("{definitions[0]}")\n{"Unique index is more restrictive" if uniques[0] else ""}'
                }))

        # Find duplicate sub-index
        # Example if there is a multi-column index ("a", "b") and a simple index ("a")
        # the second one can be remove (if you search only on "a" the multi-column index will be use partially)
        # warning, a simple index can be sightly faster (less data to read) but it rarely significant
        self.env.cr.execute("""
            SELECT
                to_remove.indrelid::regclass AS table_name,
                to_remove.indexrelid::regclass AS name_to_remove,
                to_remove.indisunique AS unique_to_remove,
                to_keep.indexrelid::regclass AS name_to_keep,
                pg_table_size(to_remove.indexrelid) AS size,
                pi_to_remove.indexdef AS def_to_remove,
                pi_to_keep.indexdef AS def_to_keep
            FROM
                pg_index AS to_keep
                JOIN pg_index AS to_remove
                    ON (
                        to_keep.indrelid = to_remove.indrelid
                        AND to_keep.indexrelid != to_remove.indexrelid
                        AND array_to_string(to_keep.indkey, ' ') || ' ' LIKE array_to_string(to_remove.indkey, ' ') || ' %'
                        AND to_keep.indkey != to_remove.indkey AND to_keep.indclass != to_remove.indclass
                        AND array_to_string(to_keep.indclass, ' ') || ' ' LIKE array_to_string(to_remove.indclass, ' ') || ' %'
                        AND (to_keep.indexprs = to_remove.indexprs OR (to_keep.indexprs IS NULL AND to_remove.indexprs IS NULL))
                        AND (to_keep.indpred = to_remove.indpred OR (to_keep.indpred IS NULL AND to_remove.indpred IS NULL))
                        AND to_remove.indisunique = to_keep.indisunique
                    )
                LEFT JOIN pg_indexes AS pi_to_keep ON pi_to_keep.indexname::regclass = to_keep.indexrelid::regclass
                LEFT JOIN pg_indexes AS pi_to_remove ON pi_to_remove.indexname::regclass = to_remove.indexrelid::regclass
            WHERE to_remove.indisprimary = FALSE
            ORDER BY
                pg_table_size(to_remove.indexrelid) DESC
        """)

        for table_name, name_to_remove, unique, name_to_keep, size, def_to_remove, def_to_keep in self.env.cr.fetchall():
            model_name = table_name.replace('_', '.')
            duplicate_index_vals.append(Command.create({
                'model_id': self.env['ir.model']._get_id(model_name),
                'name': name_to_remove,
                'human_size': human_size(size),
                'unique': unique,
                'confident': 'normal',
                'definition': def_to_remove,
                'description': f'"{name_to_remove}" ("{definition}") is a subset of "{name_to_keep}" ("{def_to_keep}"), maybe you should remove it?'
            }))

        self.duplicate_index_ids = duplicate_index_vals
