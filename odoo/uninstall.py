# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
import psycopg2

_logger = logging.getLogger(__name__)


class Uninstaller:
    def __init__(self, data):
        self.env = data.env
        self.pool = data.pool

        self.data_by_id = {(ref.model, ref.res_id): ref for ref in data}
        self.data_by_model = {
            model: self.env[model].browse(
                data.filtered(lambda ref: ref.model == model).mapped('res_id')
            ) - self.env[model].browse(
                # do not delete records that have other external ids (and thus
                # do not belong to the modules being installed)
                self.env['ir.model.data'].search([
                    ('model', '=', model),
                    ('res_id', 'in', data.mapped('res_id')),
                    ('id', 'not in', data.ids),
                ]).mapped('res_id')
            ) for model in data.mapped('model')
        }
        self.display_names = {model: {
            record.id: record.display_name for record in records
        } for model, records in self.data_by_model.items()}

        # Keep a dictionary of all nodes and the associated outward edges. A
        # separate dictionary keeps track of the indegree of each node.
        self.graph_nodes = {}
        self.edge_counts = {}

        self.build_graph()

    def build_graph(self):
        orm_tables = [
            'ir.model', 'ir.model.fields', 'ir.model.fields.selection',
            'ir.model.relation', 'ir.model.constraint',
        ]

        # Dummy nodes so that we can define dependencies on or for all fields
        # or models.
        Model = self.build_node(self.env['ir.model'])
        Field = self.build_node(self.env['ir.model.fields'])
        Value = self.build_node(self.env['ir.model.fields.selection'])
        Constraint = self.build_node(self.env['ir.model.constraint'])
        Relation = self.build_node(self.env['ir.model.relation'])

        constraints = self.data_by_model.get('ir.model.constraint', Constraint)
        selections = self.data_by_model.get('ir.model.fields.selection', Value)
        relations = self.data_by_model.get('ir.model.relation', Relation)
        fields = self.data_by_model.get('ir.model.fields', Field)
        models = self.data_by_model.get('ir.model', Model)

        # fields_by_model = {
        #     model: fields.filtered(lambda field: field.model == model)
        #     for model in fields.mapped('model')
        # }

        for model, records in self.data_by_model.items():
            if model not in orm_tables:
                self.build_node(records)

        # keys_by_model = {}

        for model, records in self.data_by_model.items():
            # keys_by_model[model] = []
            is_orm_table = model in orm_tables
            records = (self.env if is_orm_table else self.data_by_model)[model]
            for field in self.env[model]._fields.values():
                if not field.type == 'many2one':
                    continue

                comodel = field.comodel_name
                if comodel not in self.data_by_model or model == comodel:
                    continue

                allowed = ['ir_actions_server_id']
                if field.ondelete != 'cascade' and field.name not in allowed:
                    continue

                # keys_by_model[model].append((comodel, field.ondelete))
                self.build_edge(records, (
                    self.env if comodel in orm_tables else self.data_by_model
                )[comodel])

            if not is_orm_table and model != 'res.groups' and 'res.groups' in self.data_by_model:
                self.build_edge(records, self.data_by_model['res.groups'])

        # for keys in keys_by_model.values():
        #     restrict_models = [
        #         comodel for comodel, ondelete in keys
        #         if ondelete not in ('cascade', 'set null')
        #     ]
        #     priority_models = [
        #         comodel for comodel, ondelete in keys
        #         if ondelete in ('cascade', 'set null')
        #     ]

        #     for model in priority_models:
        #         is_orm_table = model in orm_tables
        #         records = (self.env if is_orm_table else self.data_by_model)[model]
        #         for dependent_model in restrict_models:
        #             self.build_edge(records, (
        #                 self.env if dependent_model in orm_tables else self.data_by_model
        #             )[dependent_model])

        for model in models:
            self.build_node(model)
            self.build_edge(Model, model)

            if model.model in self.data_by_model:
                self.build_edge(self.data_by_model[model.model], model)

        for field in fields:
            # avoid prefetching fields that are going to be deleted: during
            # uninstall, it is possible to perform a recompute (via flush_env)
            # after the database columns have been deleted but before the new
            # registry has been created, meaning the recompute will be executed
            # on a stale registry, and if some of the data for executing the
            # compute methods is not in cache it will be fetched, and fields
            # that exist in the registry but not in the database will be
            # prefetched, this will of course fail and prevent the uninstall.
            if self.env[field.model]._fields[field.name] is not None:
                self.env[field.model]._fields[field.name].prefetch = False

            self.build_node(field)
            self.build_edge(Field, field)

            # One2many fields depend on their inverses
            if field.relation_field_id and field.relation_field_id in fields:
                self.build_edge(field, field.relation_field_id)
            elif field.relation and field.relation in models.mapped('model'):
                self.build_edge(field, models.filtered(lambda model: (
                    model.model == field.relation
                )))

            if field.related_field_id and field.related_field_id in fields:
                self.build_edge(field.related_field_id, field)

            if field.model_id in models:
                self.build_edge(field, field.model_id)

            if field.model in self.data_by_model:
                self.build_edge(self.data_by_model[field.model], field)

        for value in selections:
            self.build_node(value)
            self.build_edge(Value, value)
            # Remove selection values before processing any fields
            self.build_edge(value, Field)

            if value.field_id in fields:
                self.build_edge(value, value.field_id)

            if value.field_id.model in self.data_by_model:
                related_records = self.data_by_model[value.field_id.model]
                self.build_edge(related_records, field)

        for relation in relations:
            assert relation.field_id in self.graph_nodes
            self.build_node(relation)
            self.build_edge(Relation, relation)
            self.build_edge(relation, relation.field_id)

        for constraint in constraints:
            self.build_node(constraint)
            self.build_edge(Constraint, constraint)

            if constraint.model in models:
                self.build_edge(constraint, constraint.model)

            model_name = constraint.model.model
            # field_name = constraint.name[len(model_name) + 1:-5]
            # is_restricting = constraint.type != 'f' or (
            #     self.env[model_name]._fields[field_name].ondelete not in (
            #         'cascade', 'set null'
            #     )
            # )

            if model_name in self.data_by_model:
                related_records = self.data_by_model[model_name]
                self.build_edge(constraint, related_records)

            # if model_name in self.data_by_model and not is_restricting:
            #     related_records = self.data_by_model[model_name]
            #     self.build_edge(related_records, constraint)

    def build_node(self, recordset):
        self.graph_nodes.setdefault(recordset, set())
        self.edge_counts.setdefault(recordset, 0)
        return recordset

    def build_edge(self, dependency, dependent):
        is_dependent = dependent in self.graph_nodes[dependency]
        self.edge_counts[dependent] += int(not is_dependent)
        self.graph_nodes[dependency].add(dependent)

    def uninstall(self):
        # to collect external ids of records that cannot be deleted
        undeletable = self.env['ir.model.data']
        to_remove = [node for node, count in self.edge_counts.items() if count == 0]

        while len(to_remove) > 0:
            records = to_remove.pop()
            silent = True
            undeletable |= self.delete(records, silent=silent)

            for dependent in self.graph_nodes[records]:
                if self.edge_counts[dependent] == 1:
                    to_remove.append(dependent)
                self.edge_counts[dependent] -= 1

            self.edge_counts.pop(records)
            self.graph_nodes.pop(records)

        if len(self.graph_nodes) > 0:
            self.print_cycles()
            raise Exception('Cycles detected in uninstall graph')

        # sort out which undeletable model data may have become deletable again because
        # of records being cascade-deleted or tables being dropped just above
        remaining = self.env['ir.model.data']
        for data in undeletable.exists():
            record = self.env[data.model].browse(data.res_id)
            try:
                with self.env.cr.savepoint():
                    if record.exists():
                        # record exists therefore the data is still undeletable,
                        # remove it from module_data
                        remaining |= data
                        continue
            except psycopg2.ProgrammingError:
                # This most likely means that the record does not exist, since record.exists()
                # is rougly equivalent to `SELECT id FROM table WHERE id=record.id` and it may raise
                # a ProgrammingError because the table no longer exists (and so does the
                # record), also applies to ir.model.fields, constraints, etc.
                pass
        # remove remaining module data records
        (undeletable.exists() - remaining).unlink()
        return remaining

    def delete(self, records, silent=False):
        undeletable = self.env['ir.model.data']

        # now delete the records
        if len(records) == 1:
            name = self.display_names[records._name][records.id]
            _logger.info('Deleting %s named %s', records, name)
        elif records._name == 'ir.model.fields':
            models = records.mapped('model')
            _logger.info('Deleting %s for models %s', records, models)
        else:
            _logger.info('Deleting %s', records)

        stack = [records]
        while len(stack) > 0:
            records = stack.pop()
            if len(records) == 0:
                continue
            try:
                with self.env.cr.savepoint():
                    records.unlink()
            except Exception as error:
                if len(records) <= 1:
                    name = self.display_names[records._name][records.id]
                    _logger.warning('Unable to delete %s named %s', *[
                        records, name,
                    ], exc_info=True)
                    undeletable |= undeletable.search([
                        ('model', '=', records._name),
                        ('res_id', 'in', records.ids),
                    ])
                else:
                    # divide the batch in two, and recursively delete them
                    half_size = len(records) // 2
                    stack.append(records[:half_size])
                    stack.append(records[half_size:])

                if not silent:
                    raise error

        return undeletable

    def print_cycles(self):
        reverted_graph = {}
        reverse_counts = {}

        for node, edges in self.graph_nodes.items():
            reverted_graph.setdefault(node, set())
            for edge in edges:
                reverted_graph.setdefault(edge, set())
                reverted_graph[edge].add(node)
            reverse_counts[node] = len(edges)

        to_remove = [node for node, count in reverse_counts.items() if count == 0]

        while len(to_remove) > 0:
            records = to_remove.pop()
            for dependent in reverted_graph[records]:
                if reverse_counts[dependent] == 1:
                    to_remove.append(dependent)
                reverse_counts[dependent] -= 1

            reverse_counts.pop(records)
            reverted_graph.pop(records)

        _logger.error('\n'.join(['Cycles detected in uninstall graph'] + [
            f'    Node {node} with outdegree {reverse_counts[node]} depends on\n' + '\n'.join([
                f'        Node {dependency}' for dependency in dependencies
            ]) for node, dependencies in reverted_graph.items()
        ]))
