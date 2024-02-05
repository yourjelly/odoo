from __future__ import annotations

import itertools

from odoo import models
from odoo.tools.misc import OrderedSet

from odoo.tools.sql import SQL


class Base(models.AbstractModel):
    _inherit = 'base'

    def _records_by_group_current(self, unfolded_groups, read_specification, search_limit, search_order):
        for group in unfolded_groups:
            # Different transaction then invalidation between requests
            self.env.invalidate_all()
            group['__records'] = self.web_search_read(
                group['__domain'], read_specification, limit=search_limit, order=search_order, count_limit=10000,
            )['records']

    def _records_by_group_current_improved(self, unfolded_groups, read_specification, search_limit, search_order):
        # Same than before but avoid search_count because already in __count of the groups
        for group in unfolded_groups:
            # Different transaction then invalidation between requests
            self.env.invalidate_all()
            group['__records'] = self.web_search_read(
                group['__domain'], read_specification, limit=search_limit, order=search_order, count_limit=search_limit,
            )['records']

    def _records_by_group_naive_web_search_read(self, unfolded_groups, read_specification, search_limit, search_order):
        # _records_by_group_current_improved but sequentially same cache
        for group in unfolded_groups:
            group['__records'] = self.web_search_read(
                group['__domain'], read_specification, limit=search_limit, order=search_order, count_limit=search_limit,
            )['records']

    def _records_by_group_naive_search(self, unfolded_groups, read_specification, search_limit, search_order):
        all_record_ids = OrderedSet()
        for group in unfolded_groups:
            records = self.search(group['__domain'], limit=search_limit, order=search_order)
            group['__records'] = records._ids
            all_record_ids.update(records._ids)

        all_records = self.browse(all_record_ids)
        map_read = {
            record_dict['id']: record_dict
            for record_dict in all_records.web_read(read_specification)
        }
        for group in unfolded_groups:
            group['__records'] = [map_read[id_] for id_ in group['__records']]

    def _records_by_group_naive_search_fetch(self, unfolded_groups, read_specification, search_limit, search_order):
        all_record_ids = OrderedSet()
        for group in unfolded_groups:
            # This version is actually slower than `_records_by_group_naive_search`
            # because `search_fetch` unbatch X2many fields
            # The kanban view of res.partner should be clean
            records = self.search_fetch(group['__domain'], list(read_specification), limit=search_limit, order=search_order)
            group['__records'] = records._ids
            all_record_ids.update(records._ids)

        all_records = self.browse(all_record_ids)
        map_read = {
            record_dict['id']: record_dict
            for record_dict in all_records.web_read(read_specification)
        }
        for group in unfolded_groups:
            group['__records'] = [map_read[id_] for id_ in group['__records']]

    def _records_by_group_union_all(self, unfolded_groups, read_specification, search_limit, search_order):
        subqueries = [
            SQL(
                '(%s)',
                self._search(group['__domain'], limit=search_limit, order=search_order).select(
                    SQL.identifier(self._table, 'id'), SQL('%s', i),
                ),
            )
            for i, group in enumerate(unfolded_groups)
        ]
        sql_result = self.env.execute_query(SQL('UNION ALL').join(subqueries))
        all_records = self.browse(OrderedSet(id_ for id_, __ in sql_result))

        map_read = {
            record_dict['id']: record_dict
            for record_dict in all_records.web_read(read_specification)
        }
        for group in unfolded_groups:
            group['__records'] = []
        for id_, group_i in sql_result:
            unfolded_groups[group_i]['__records'].append(id_)

        for group in unfolded_groups:
            group['__records'] = [map_read[id_] for id_ in group['__records']]

    def _records_by_group_union_all_cte_replace_table(self, unfolded_groups, base_domain, read_specification, search_limit, search_order):
        main_query = self._search(base_domain, order=search_order)
        cte_sql = SQL('WITH %s AS (%s)', SQL.identifier(self._table), main_query.select("*"))

        def groupby_leaf_domain(domain):
            # take only the part of the domain implied in group
            return [domain[-1]]

        subqueries = [
            SQL(
                '(%s)',
                self.sudo()._search(groupby_leaf_domain(group['__domain']), limit=search_limit).select(
                    SQL.identifier(self._table, 'id'), SQL('%s', i),
                ),
            )
            for i, group in enumerate(unfolded_groups)
        ]
        sql_result = self.env.execute_query(SQL('%s %s', cte_sql, SQL('UNION ALL').join(subqueries)))
        all_records = self.browse(OrderedSet(id_ for id_, __ in sql_result))

        map_read = {
            record_dict['id']: record_dict
            for record_dict in all_records.web_read(read_specification)
        }
        for group in unfolded_groups:
            group['__records'] = []
        for id_, group_i in sql_result:
            unfolded_groups[group_i]['__records'].append(id_)

        for group in unfolded_groups:
            group['__records'] = [map_read[id_] for id_ in group['__records']]

    def _records_by_group_union_all_cte_group_key(self, unfolded_groups, groupby_spec, base_domain, read_specification, search_limit, search_order):
        main_query = self._search(base_domain, order=search_order)
        group_by_sql = self._read_group_groupby(groupby_spec, main_query)

        cte_name = self._table + '_cte'
        cte_sql = SQL(
            'WITH %s AS (%s)', SQL.identifier(cte_name),
            main_query.select(
                SQL.identifier(self._table, 'id'),
                SQL('%s AS "__groupby_key__"', group_by_sql),
            ),
        )

        # TODO not completely correct for date
        def group_value_to_sql(value):
            if not value:
                return SQL('IS NULL')
            if isinstance(value, tuple):
                value = value[0]
            return SQL('= %s', value)

        subqueries = [
            SQL(
                '(SELECT %s, %s FROM %s WHERE %s %s LIMIT %s)',
                SQL.identifier(cte_name, 'id'), SQL('%s', i),
                SQL.identifier(cte_name),
                SQL.identifier(cte_name, '__groupby_key__'), group_value_to_sql(group[groupby_spec]),
                search_limit,
            )
            for i, group in enumerate(unfolded_groups)
        ]
        sql_result = self.env.execute_query(SQL('%s %s', cte_sql, SQL('UNION ALL').join(subqueries)))
        all_records = self.browse(OrderedSet(id_ for id_, __ in sql_result))

        map_read = {
            record_dict['id']: record_dict
            for record_dict in all_records.web_read(read_specification)
        }
        for group in unfolded_groups:
            group['__records'] = []
        for id_, group_i in sql_result:
            unfolded_groups[group_i]['__records'].append(id_)

        for group in unfolded_groups:
            group['__records'] = [map_read[id_] for id_ in group['__records']]

    def _records_by_group_union_all_cte_group_key_2(self, unfolded_groups, groupby_spec, base_domain, read_specification, search_limit, search_order):
        all_values = [
            (group[groupby_spec][0] if isinstance(group[groupby_spec], tuple) else group[groupby_spec])
            for group in unfolded_groups
        ]
        base_domain = base_domain + [(groupby_spec, 'in', all_values)]
        main_query = self._search(base_domain, order=search_order)
        group_by_sql = self._read_group_groupby(groupby_spec, main_query)

        cte_name = self._table + '_cte'
        cte_sql = SQL(
            'WITH %s AS (%s)', SQL.identifier(cte_name),
            main_query.select(
                SQL.identifier(self._table, 'id'),
                SQL('%s AS "__groupby_key__"', group_by_sql),
            ),
        )

        # TODO not completely correct for date
        def group_value_to_sql(value):
            if not value:
                return SQL('IS NULL')
            if isinstance(value, tuple):
                value = value[0]
            return SQL('= %s', value)

        subqueries = [
            SQL(
                '(SELECT %s, %s FROM %s WHERE %s %s LIMIT %s)',
                SQL.identifier(cte_name, 'id'), SQL('%s', i),
                SQL.identifier(cte_name),
                SQL.identifier(cte_name, '__groupby_key__'), group_value_to_sql(group[groupby_spec]),
                search_limit,
            )
            for i, group in enumerate(unfolded_groups)
        ]
        sql_result = self.env.execute_query(SQL('%s %s', cte_sql, SQL('UNION ALL').join(subqueries)))
        all_records = self.browse(OrderedSet(id_ for id_, __ in sql_result))

        map_read = {
            record_dict['id']: record_dict
            for record_dict in all_records.web_read(read_specification)
        }
        for group in unfolded_groups:
            group['__records'] = []
        for id_, group_i in sql_result:
            unfolded_groups[group_i]['__records'].append(id_)

        for group in unfolded_groups:
            group['__records'] = [map_read[id_] for id_ in group['__records']]

    def web_read_group_unity(
        self,
        domain,
        groupby,
        aggregates,
        method_to_read_groups,
        order = None,  # Can be override when we are in list views
        limit = 80,
        offset = 0,
        unfolded_limit = 10,
    ):
        # read_group change to do first:
        #  - fill_temporal in the JS
        #  - no more __context
        #  - return only part of the domain concerned by the groupby or not at all
        #  - always (raw value, labeled value)
        #  - __fold management
        #  - group_extand ???
        if not order and groupby:
            order = ", ".join(groupby)
        groups = self.read_group(domain, aggregates, groupby, offset=offset, limit=limit, orderby=order)

        if not groups:
            length = 0
        elif limit and len(groups) == limit:
            length = limit + len(self._read_group(
                domain,
                groupby=groupby,
                offset=limit,
            ))
        else:
            length = len(groups) + offset

        if len(groupby) == 1:
            is_relational = groupby[0] in self._fields and self._fields[groupby[0]].relational
            unfolded_groups = list(itertools.islice(
                # Falsy groups should be fold by default for relational field
                # unfolded_limit groups are opened by default
                filter(
                    lambda g: (
                        not (g.get('__fold', False) and (not is_relational or g.get(groupby[0])))
                        and g[f'{groupby[0]}_count'] > 0
                    ),
                    groups,
                ),
                unfolded_limit,
            ))
            # with self.env.cr._enable_logging():
            method_to_read_groups(self, unfolded_groups)

        return {
            'groups': groups,
            'length': length,
        }
