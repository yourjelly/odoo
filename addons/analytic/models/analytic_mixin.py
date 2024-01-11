# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import models, fields, api, _, Command
from odoo.tools.float_utils import float_round, float_compare
from odoo.exceptions import UserError, ValidationError
from odoo.tools import ormcache

class AnalyticMixin(models.AbstractModel):
    _name = 'analytic.mixin'
    _description = 'Analytic Mixin'

    analytic_distribution = fields.Json(
        'Analytic Distribution',
        compute='_compute_analytic_distribution',
        inverse='_inverse_analytic_distribution',
        copy=True,
    )
    analytic_line_ids = fields.One2many(
        string='Analytic lines',
        comodel_name='account.analytic.line',
        inverse_name='source_document_id',
    )

    @api.depends('analytic_line_ids')
    def _compute_analytic_distribution(self):
        project_plan, other_plans = self.env['account.analytic.plan']._get_all_plans()
        for record in self:
            record.analytic_distribution = {
                ','.join(str(analytic[plan._column_name()].id) for plan in project_plan | other_plans if analytic[plan._column_name()]): analytic.percentage * 100
                for analytic in record.analytic_line_ids
            }

    def _inverse_analytic_distribution(self):
        for record in self:
            record.analytic_line_ids = record._distribution_to_commands(record.analytic_distribution)
        # The amount needs to be recomputed based on the percentage if the base was computed later
        self.env.add_to_compute(self.env['account.analytic.line']._fields['amount'], self.analytic_line_ids)

    def _distribution_to_commands(self, distribution):
        reference_field = self._get_analytic_reference_field(self._name)
        return [Command.clear()] + [
            Command.create({
                **{
                    account.plan_id._column_name(): account.id
                    for account in self.env['account.analytic.account'].browse(map(int, analytic_account_ids.split(",")))
                },
                'amount': 0,
                'percentage': percentage / 100,
                'source_document_model': self._name,
                'source_document_id': self.id,
                reference_field: self.id,
            })
            for analytic_account_ids, percentage in (distribution or {}).items()
        ]

    def _validate_distribution(self, **kwargs):
        if self.env.context.get('validate_analytic', False):
            mandatory_plans_ids = [plan['id'] for plan in self.env['account.analytic.plan'].sudo().get_relevant_plans(**kwargs) if plan['applicability'] == 'mandatory']
            if not mandatory_plans_ids:
                return
            decimal_precision = self.env['decimal.precision'].precision_get('Percentage Analytic')
            distribution_by_root_plan = {}
            for analytic_account_ids, percentage in (self.analytic_distribution or {}).items():
                for analytic_account in self.env['account.analytic.account'].browse(map(int, analytic_account_ids.split(","))).exists():
                    root_plan = analytic_account.root_plan_id
                    distribution_by_root_plan[root_plan.id] = distribution_by_root_plan.get(root_plan.id, 0) + percentage

            for plan_id in mandatory_plans_ids:
                if float_compare(distribution_by_root_plan.get(plan_id, 0), 100, precision_digits=decimal_precision) != 0:
                    raise ValidationError(_("One or more lines require a 100% analytic distribution."))

    def unlink(self):
        self.analytic_line_ids.unlink()  # ondelete='cascade' for the m2o reference
        return super().unlink()

    def _get_view(self, view_id=None, view_type='form', **options):
        arch, view = super()._get_view(view_id, view_type, **options)
        line_nodes = arch.findall('.//field[@name="analytic_line_ids"]')
        for line_node in line_nodes:
            self.env['account.analytic.line']._patch_view(line_node, False, source_model=self)
        return arch, view

    @ormcache('model')
    def _get_analytic_reference_field(self, model):
        return next(
            f for f in self.env['account.analytic.line']._fields.values()
            if isinstance(f, fields.Many2oneReferenceField)
            and f.comodel_name == model
        ).name
