# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging

from odoo import api, fields, models
from odoo.tools import graph

_logger = logging.getLogger(__name__)


class View(models.Model):
    _inherit = 'ir.ui.view'

    @api.model
    def get_graph(self, id, model, node_obj, conn_obj, src_node, des_node, label, scale):
        def rec_name(rec):
            return (rec.name if 'name' in rec else
                    rec.x_name if 'x_name' in rec else
                    None)
        nodes = []
        nodes_name = []
        transitions = []
        start = []
        tres = {}
        labels = {}
        no_ancester = []
        blank_nodes = []

        start_node = self.env['ir.model'].browse(id)
        start.append(start_node.id)
        nodes_name.append((start_node.id, rec_name(start_node)))
        nodes.append(start_node.id)
        relation_fields = start_node.field_id.filtered(lambda t: t.ttype in ('many2one', 'many2many', 'one2many'))

        for field in relation_fields:
            nodes_name.append((field.relation_model_id.id, rec_name(field.relation_model_id)))
            nodes.append(field.relation_model_id.id)

            transitions.append((start_node.id, field.relation_model_id.id))
            tres[str(field.id)] = (start_node.id, field.relation_model_id.id)
            label_string = [field.ttype, field.name]
            labels[str(field.id)] = (field.relation_model_id.id, label_string)

        g = graph(nodes, transitions, no_ancester)
        g.process(start)
        g.scale(*scale)
        result = g.result_get()
        results = {}
        for node_id, node_name in nodes_name:
            results[str(node_id)] = result[node_id]
            results[str(node_id)]['name'] = node_name
            results[str(node_id)]['id'] = node_id

        return {'nodes': results,
                'transitions': tres,
                'label': labels,
                'blank_nodes': blank_nodes,
                'node_parent_field': 'model_id'}