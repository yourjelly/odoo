# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _

class ProjectMilestone(models.Model):
    _inherit = 'project.milestone'

    def _default_production_service_id(self):
        project_id = self._context.get('default_project_id')
        if not project_id:
            return []
        project = self.env['project.project'].browse(project_id)
        return self.env['mrp.production.service'].search([
            ('production_id', '=', project.production_id.id),
            ('qty_delivered_method', '=', 'milestones'),
        ], limit=1)

    production_service_id = fields.Many2one('mrp.production.service', 'MO Service', default=_default_production_service_id, help='Manufacturing order service line that will be updated once the milestone is reached.',
        domain="[('qty_delivered_method', '=', 'milestones')]")

    production_service_display_name = fields.Char("Production Service Display Name", related='production_service_id.display_name')

    @api.depends('production_service_id.product_qty', 'product_uom_qty')
    def _compute_quantity_percentage(self):
        for milestone in self:
            if milestone.production_service_id:
                milestone.quantity_percentage = milestone.production_service_id.product_qty and milestone.product_uom_qty / milestone.production_service_id.product_qty
            else:
                super(ProjectMilestone, milestone)._compute_quantity_percentage()

    @api.depends('production_service_id', 'quantity_percentage')
    def _compute_product_uom_qty(self):
        for milestone in self:
            if milestone.production_service_id:
                if milestone.quantity_percentage:
                    milestone.product_uom_qty = milestone.quantity_percentage * milestone.production_service_id.product_qty
                else:
                    milestone.product_uom_qty = milestone.production_service_id.product_qty
            else:
                super(ProjectMilestone, milestone)._compute_product_uom_qty()

    @api.depends('production_service_id.product_uom_id')
    def _compute_product_uom(self):
        for milestone in self:
            if milestone.production_service_id:
                milestone.product_uom = milestone.production_service_id.product_uom_id
            else:
                super(ProjectMilestone, milestone)._compute_product_uom()

    @api.model
    def _get_fields_to_export(self):
        return super()._get_fields_to_export() + ['production_service_display_name']

    def action_view_production_order(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': _('Production Order'),
            'res_model': 'mrp.production',
            'res_id': self.production_service_id.production_id.id,
            'view_mode': 'form',
        }
