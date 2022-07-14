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

        # Somehow constraints and relations are not included when uninstalling
        # module data.
        Model = self.env['ir.model']
        Constraint = self.env['ir.model.constraint']
        Relation = self.env['ir.model.relation']

        models = self.data_by_model.get('ir.model', Model)
        constraints = self.env['ir.model.constraint'].search([
            ('model', 'in', models.ids),
        ])
        relations = self.env['ir.model.relation'].search([
            ('model', 'in', models.ids),
        ])

        if len(constraints) > 0:
            self.data_by_model.setdefault('ir.model.constraint', Constraint)
            self.data_by_model['ir.model.constraint'] += constraints

        if len(relations) > 0:
            self.data_by_model.setdefault('ir.model.relation', Relation)
            self.data_by_model['ir.model.relation'] += relations

        # Cache all display names so that we don't have to perform read
        # operations anymore while removing data. For example, when failing to
        # remove a record that no longer exists (perhaps it was previously
        # cascade deleted), this can pose problems.
        self.display_names = {model: {
            record.id: record.display_name for record in records
        } for model, records in self.data_by_model.items()}

        self.build_graph()

    def build_graph(self):
        '''
        Build a dependency graph defining the removal order of the data being
        uninstalled. A node in the graph is identified by a recordset.
        '''

        # Keep a dictionary of all nodes and the associated outward edges. A
        # separate dictionary keeps track of the indegree of each node.
        self.graph_nodes = {}
        self.edge_counts = {}

        # Extra steps can be defined for each model. A step is a callable
        # accepting a recordset as an argument.
        self.extra_steps = {model: [] for model in self.data_by_model.keys()}

        orm_tables = [
            'ir.model', 'ir.model.fields', 'ir.model.fields.selection',
            'ir.model.relation', 'ir.model.constraint',
        ]

        # Records in orm tables are not generally represented as a single node
        # in the graph, which means we cannot simply define dependencies for
        # all targeted records in an orm table. This can be circumvented by
        # defining dummy nodes using empty recordsets having all nodes in the
        # same orm table as its dependents.
        Model = self.build_node(self.env['ir.model'])
        Field = self.build_node(self.env['ir.model.fields'])
        Value = self.build_node(self.env['ir.model.fields.selection'])
        Constraint = self.build_node(self.env['ir.model.constraint'])
        Relation = self.build_node(self.env['ir.model.relation'])

        models = self.data_by_model.get('ir.model', Model)
        fields = self.data_by_model.get('ir.model.fields', Field)
        selections = self.data_by_model.get('ir.model.fields.selection', Value)
        constraints = self.data_by_model.get('ir.model.constraint', Constraint)
        relations = self.data_by_model.get('ir.model.relation', Relation)

        groups = self.data_by_model.get('res.groups', self.env['res.groups'])

        #######################################################################
        # Generate removal nodes for model data                               #
        #######################################################################

        for model, records in self.data_by_model.items():
            # Only generate removal nodes for data when the associated model
            # and database table is not targeted for removal.
            if model not in orm_tables and model not in models.mapped('model'):
                self.build_node(records)

        #######################################################################
        # Generate model removal nodes                                        #
        #######################################################################

        for model in models:
            self.build_node(model)
            self.build_edge(Model, model)

            # if model.model in self.data_by_model:
            #     self.build_edge(self.data_by_model[model.model], model)

        #######################################################################
        # Generate foreign key based dependencies between model data          #
        #######################################################################

        # In general, data referencing data from other models will be removed
        # before the data they are referencing. This means every many2one field
        # involving a model and comodel that both have data being targeted for
        # removal will generate a dependency.

        # The set_null_step method returns a callable that accepts a recordset
        # and will set a given many2one field on the recordset to null whenever
        # the id is contained in a list of given ids.
        def set_null_step(field, nullable_ids):
            return lambda records: records.filtered(lambda record: (
                record[field.name].id in nullable_ids
            )).write({field.name: False})

        for model, records in self.data_by_model.items():
            is_orm_table = model in orm_tables
            records = (self.env if is_orm_table else self.data_by_model)[model]
            for field in self.env[model]._fields.values():
                if not field.type == 'many2one':
                    continue

                if model in models.mapped('model'):
                    continue

                comodel = field.comodel_name
                if comodel not in self.data_by_model or model == comodel:
                    continue

                # Many2one fields that are not required allow us to break
                # potential cycles in foreign keys. In this case the dependency
                # of the referenced record is skipped, instead the many2one
                # field is manually set to null before calling unlink (whenever
                # the referenced comodel record is also targeted for removal).
                # For an example see the dependencies between stock.warehouse
                # and stock.location.route (restricting foreign keys in both
                # directions).
                # FIXME Investigate if problems might result when such a
                # comodel record turns out to be undeletable.
                if not field.required:
                    steps = self.extra_steps[model]
                    nullable_ids = self.data_by_model[comodel].ids
                    steps.append(set_null_step(field, nullable_ids))
                    continue

                dependent_records = (
                    self.env if comodel in orm_tables else self.data_by_model
                )[comodel]

                # Special case: if the model of the comodel records will also
                # be removed, the dependent becomes the comodel.
                if comodel in models.mapped('model'):
                    dependent_records = models.filtered(lambda model: (
                        model.model == comodel
                    ))

                self.build_edge(records, dependent_records)

            # When unlinking data, manual access rights checks may potentially
            # depend on user groups that will also be removed.
            is_node = not is_orm_table and model not in models.mapped('model')
            if is_node and model != 'res.groups' and len(groups) > 0:
                self.build_edge(records, groups)

        #######################################################################
        # Generate field removal nodes                                        #
        #######################################################################

        simple_fields = fields.filtered(lambda field: all([
            field.ttype not in ('one2many', 'many2one', 'many2many'),
            not field.related_field_id,
        ]))
        simple_fields_by_model = {
            model: simple_fields.filtered(lambda field: field.model == model)
            for model in simple_fields.mapped('model')
        }

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

        for model, simple_fields in simple_fields_by_model.items():
            self.build_node(simple_fields)
            self.build_edge(Field, simple_fields)

        for field in fields - simple_fields:
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
                dependency = field.related_field_id
                if field.related_field_id in simple_fields:
                    dependency = simple_fields_by_model[dependency.model]
                self.build_edge(field.related_field_id, field)

            if field.model_id in models:
                self.build_edge(field, field.model_id)

            if field.model in models.mapped('model'):
                continue
            elif field.model in self.data_by_model:
                self.build_edge(self.data_by_model[field.model], field)

        #######################################################################
        # Generate selection value removal nodes                              #
        #######################################################################

        # Selection values should be removed before any fields. Depending on
        # its ondelete value, removing a selection value potentially calls
        # unlink. Since unlink might still use other fields as well we cannot
        # simply depend only on the associated field (should it also be
        # targeted for removal).
        # FIXME Investigate if it makes more sense for cascade deletions by
        # selection values to bypass the unlink method. This would more closely
        # mimic its foreign key counterpart. In this case a dependency for the
        # associated field on the selection value should be introduced.

        for value in selections:
            self.build_node(value)
            self.build_edge(Value, value)
            self.build_edge(value, Field)

            model_name = value.field_id.model
            if model_name in models.mapped('model'):
                continue
            elif model_name in self.data_by_model:
                related_records = self.data_by_model[model_name]
                self.build_edge(related_records, value)

        #######################################################################
        # Generate contraint removal nodes                                    #
        #######################################################################

        for constraint in constraints:
            self.build_node(constraint)
            self.build_edge(Constraint, constraint)
            self.build_edge(constraint, Relation)

            if constraint.model in models:
                self.build_edge(constraint, constraint.model)

            model_name = constraint.model.model
            if model_name in models.mapped('model'):
                continue
            elif model_name in self.data_by_model:
                related_records = self.data_by_model[model_name]
                self.build_edge(related_records, constraint)

        #######################################################################
        # Generate many2many relation removal nodes                           #
        #######################################################################

        for relation in relations:
            self.build_node(relation)
            self.build_edge(Relation, relation)
            self.build_edge(relation, Field)

    def build_node(self, recordset):
        self.graph_nodes.setdefault(recordset, set())
        self.edge_counts.setdefault(recordset, 0)
        return recordset

    def build_edge(self, dependency, dependent):
        is_dependent = dependent in self.graph_nodes[dependency]
        self.edge_counts[dependent] += int(not is_dependent)
        self.graph_nodes[dependency].add(dependent)

    def uninstall(self):
        '''
        This method carries out the actual uninstallation process of the
        selected records. The graph is traversed in topological order ensuring
        the deletion of dependencies before dependents. For efficiency purposes
        recordsets of the same model are collected and processed together.
        '''
        starting_nodes = [
            node for node, count in self.edge_counts.items() if count == 0
        ]

        # Organize the removable nodes by model name.
        data_to_remove = {model: [
            node for node in starting_nodes if node._name == model
        ] for model in set(node._name for node in starting_nodes)}

        # Initialize a recordset to collect xml ids that cannot be deleted.
        undeletable = self.env['ir.model.data']

        while len(data_to_remove) > 0:
            # Retrieve the oldest key (guaranteed as of python 3.7).
            key = next(iter(data_to_remove))
            nodes = data_to_remove.pop(key)
            silent = True

            # First the graph is updated to reflect the removal of the selected
            # nodes. This step also includes logging so that each log line
            # corresponds to a node in the graph.
            for records in nodes:
                if len(records) == 1:
                    name = self.display_names[records._name][records.id]
                    _logger.info('Deleting %s named %s', records, name)
                elif records._name == 'ir.model.fields':
                    models = records.mapped('model_id.model')
                    _logger.info('Deleting %s for models %s', records, models)
                else:
                    _logger.info('Deleting %s', records)

                for dependent in self.graph_nodes[records]:
                    if self.edge_counts[dependent] == 1:
                        data_to_remove.setdefault(dependent._name, [])
                        data_to_remove[dependent._name].append(dependent)
                    self.edge_counts[dependent] -= 1

                self.edge_counts.pop(records)
                self.graph_nodes.pop(records)

            # Now delete the records in one go.
            all_records = sum(nodes, self.env[key])
            undeletable |= self.delete(all_records, silent=silent)

        if len(self.graph_nodes) > 0:
            self.print_cycles()
            raise Exception('Cycles detected in uninstall graph')

        # Sort out which undeletable model data may have become deletable again
        # because of records being cascade deleted or tables being dropped.
        remaining = self.env['ir.model.data']
        for data in undeletable.exists():
            record = self.env[data.model].browse(data.res_id)
            try:
                with self.env.cr.savepoint():
                    if record.exists():
                        # Record exists, therefore the data is still
                        # undeletable, add it to remaining records.
                        remaining |= data
                        name = self.display_names[record._name][record.id]
                        _logger.warning('Undeletable record %s named %s', *[
                            record, name,
                        ])
                        continue
            except psycopg2.ProgrammingError:
                # This most likely means that the record does not exist, since
                # record.exists() is rougly equivalent to `SELECT id FROM table
                # WHERE id=record.id` and it may raise a ProgrammingError
                # because the table no longer exists (and so does the record),
                # also applies to ir.model.fields, constraints, etc.
                pass
        # remove remaining module data records
        (undeletable.exists() - remaining).unlink()
        return remaining

    def delete(self, records, silent=False):
        '''
        This method tries to unlink a recordset.

        :param records: The recordsret targeted for removal
        :param silent: Will supress exceptions if true
        :return: A recordset with any remaining undeletable records
        '''
        undeletable = self.env['ir.model.data']
        steps = self.extra_steps.get(records._name, [])

        stack = [records]
        while len(stack) > 0:
            records = stack.pop()
            if len(records) == 0:
                continue
            try:
                with self.env.cr.savepoint():
                    for execute_step in steps:
                        execute_step(records)
                    if records._name == 'ir.model.relation':
                        records._module_data_uninstall()
                    elif records._name == 'ir.model.constraint':
                        records._module_data_uninstall()
                    else:
                        records.unlink()
            except Exception:
                if len(records) > 1:
                    # divide the batch in two, and recursively delete them
                    half_size = len(records) // 2
                    stack.append(records[:half_size])
                    stack.append(records[half_size:])
                    continue

                name = self.display_names[records._name][records.id]
                _logger.warning('Unable to delete %s named %s', *[
                    records, name,
                ], exc_info=True)
                undeletable |= undeletable.search([
                    ('model', '=', records._name),
                    ('res_id', 'in', records.ids),
                ])

        if not silent and len(undeletable) > 0:
            raise RuntimeError('Unable to remove %s', undeletable)

        return undeletable

    def print_cycles(self):
        '''
        This method can called when cycles are detected in the remaining graph
        and requires that all non-cyclic dependencies were already removed
        from the graph.

        However, this does not mean that all remaining nodes in the graph have
        cyclic dependencies, since the remaing part of the graph can still
        contain non-cyclic dependents. To extract only the cyclic part, the
        graph is reversed and the non-cyclic dependents are pruned.
        '''
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
