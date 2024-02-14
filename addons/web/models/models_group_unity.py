import itertools

from odoo import models, api
from odoo.tools.misc import OrderedSet

from odoo.tools.sql import SQL


class Base(models.AbstractModel):
    _inherit = 'base'

    @api.readonly
    @api.model
    def web_read_group_unity_naive_search(
        self,
        domain,
        groupby,
        aggregates,
        read_specification,
        search_limit=80,
        search_order=None,
        order = None,
        limit = 80,
        offset = 0,
        unfolded_limit = 10,
    ):
        result, unfolded_groups = self._web_read_group_unity(domain, groupby, aggregates, order, limit, offset, unfolded_limit)
        if unfolded_groups:
            self._records_by_group_naive_search(unfolded_groups, read_specification, search_limit, search_order)
        return result

    @api.readonly
    @api.model
    def web_read_group_unity_union_all(
        self,
        domain,
        groupby,
        aggregates,
        read_specification,
        search_limit=80,
        search_order=None,
        order = None,
        limit = 80,
        offset = 0,
        unfolded_limit = 10,
    ):
        result, unfolded_groups = self._web_read_group_unity(domain, groupby, aggregates, order, limit, offset, unfolded_limit)
        if unfolded_groups:
            self._records_by_group_union_all(unfolded_groups, read_specification, search_limit, search_order)
        return result

    @api.readonly
    @api.model
    def web_read_group_unity_union_all_cte(
        self,
        domain,
        groupby,
        aggregates,
        read_specification,
        search_limit=80,
        search_order=None,
        order = None,
        limit = 80,
        offset = 0,
        unfolded_limit = 10,
    ):
        result, unfolded_groups = self._web_read_group_unity(domain, groupby, aggregates, order, limit, offset, unfolded_limit)
        if unfolded_groups:
            self._records_by_group_union_all_cte(unfolded_groups, groupby[0], domain, read_specification, search_limit, search_order)
        return result

    # ====== COMMON METHODS ===========

    def _get_unfolded_groups(self, groupby, groups, unfolded_limit):
        if len(groupby) != 1:
            return []

        is_relational = groupby[0] in self._fields and self._fields[groupby[0]].relational
        return list(itertools.islice(
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

    def _web_read_group_unity(self,
        domain,
        groupby,
        aggregates,
        order = None,  # Can be override when we are in list views
        limit = 80,
        offset = 0,
        unfolded_limit = 10,
    ):
        # Return unfolded_groups
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

        return {
            'groups': groups,
            'length': length,
        }, self._get_unfolded_groups(groupby, groups, unfolded_limit)

    # ====== PRIVATE SPECIFIC METHODS ===========

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

    def _records_by_group_union_all(self, unfolded_groups, read_specification, search_limit, search_order):
        subqueries = [
            SQL(
                '(%s)',
                self._search(group['__domain'], limit=search_limit, order=search_order or self._order).select(
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

    def _records_by_group_union_all_cte(self, unfolded_groups, groupby_spec, base_domain, read_specification, search_limit, search_order):
        all_values = [
            (group[groupby_spec][0] if isinstance(group[groupby_spec], tuple) else group[groupby_spec])
            for group in unfolded_groups
        ]
        base_domain = base_domain + [(groupby_spec, 'in', all_values)]
        main_query = self._search(base_domain, order=search_order or self._order)
        group_by_sql = self._read_group_groupby(groupby_spec, main_query)

        cte_name = self._table + '_cte'
        cte_sql = SQL(
            'WITH %s AS (%s)', SQL.identifier(cte_name),
            main_query.select(
                SQL.identifier(self._table, 'id'),
                SQL('%s AS "__groupby_key__"', group_by_sql),
            ),
        )

        # TODO not correct for date
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
