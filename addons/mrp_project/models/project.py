# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class Project(models.Model):
    _inherit = "project.project"

    production_count = fields.Integer(related="analytic_account_id.production_count")
    workorder_count = fields.Integer(related="analytic_account_id.workorder_count")
    bom_count = fields.Integer(related="analytic_account_id.bom_count")

    def action_view_mrp_production(self):
        self.ensure_one()
        result = {
            "type": "ir.actions.act_window",
            "res_model": "mrp.production",
            "domain": [['analytic_account_id', 'in', self.analytic_account_id.ids]],
            "name": "Manufacturing Orders",
            'view_mode': 'tree,form',
        }
        if self.production_count == 1:
            result['view_mode'] = 'form'
            result['res_id'] = self.analytic_account_id.production_ids.id
        return result

    def action_view_mrp_bom(self):
        self.ensure_one()
        result = {
            "type": "ir.actions.act_window",
            "res_model": "mrp.bom",
            "domain": [['analytic_account_id', 'in', self.analytic_account_id.ids]],
            "name": "Bills of Materials",
            'view_mode': 'tree,form',
        }
        if self.production_count == 1:
            result['view_mode'] = 'form'
            result['res_id'] = self.analytic_account_id.production_ids.id
        return result

    def action_view_workorder(self):
        self.ensure_one()
        result = {
            "type": "ir.actions.act_window",
            "res_model": "mrp.workorder",
            "domain": [['workcenter_id', 'in', self.analytic_account_id.workcenter_ids.ids]],
            "context": {"create": False},
            "name": "Work Orders",
            'view_mode': 'tree',
        }
        return result
