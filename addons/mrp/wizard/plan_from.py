# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class MrpPlanFrom(models.TransientModel):
    _name = 'mrp.plan.from'
    _description = 'Plan From Wizard'

    mrp_production_ids = fields.Many2many('mrp.production')
    plan_from = fields.Datetime(
        'Plan From', default=fields.Datetime.now, required=True,
        help='Date at which you plan to start the production.')

    def plan(self):
        self.mrp_production_ids.with_context(force_date=True).date_planned_start = self.plan_from
        return self.mrp_production_ids._button_plan()
