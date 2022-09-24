# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import models, fields, api
import json
from odoo.tools import float_repr


class AnalyticMixin(models.AbstractModel):
    _name = 'analytic.mixin'
    _description = 'Analytic Mixin'

    # We create 2 different fields, with a computed binary field, so we don't have to decode encode each time the json.
    # We also format the float values of the stored field, so we can use it as key (for tax detail for ex.)
    analytic_distribution_stored_char = fields.Char(
        compute="_compute_analytic_distribution_stored_char", store=True, copy=True)
    analytic_distribution = fields.Binary(
        string="Analytic Distribution",
        compute="_compute_analytic_distribution",
        inverse="_inverse_analytic_distribution",
        readonly=False,
    )
    analytic_distribution_widget = fields.Binary(
        string="Analytic",
        compute="_compute_plans_and_distribution",
        inverse="_inverse_plans_and_distribution",
        readonly=False,
    )

    def _compute_analytic_distribution_stored_char(self):
        pass

    def _get_plan_params(self):
        print('_get_plan_params', self.env.context)
        self.ensure_one()
        params = {}
        if self.analytic_distribution_stored_char:
            distribution_json = json.loads(self.analytic_distribution_stored_char)
            params['existing_account_ids'] = [int(k) for k in distribution_json.keys()]
        if self.env.context.get('force_applicability'):
            params['applicability'] = self.env.context.get('force_applicability')
        if self.env.context.get('business_domain'):
            params['business_domain'] = self.env.context.get('business_domain')
        return params

    @api.depends('analytic_distribution_stored_char')
    def _compute_analytic_distribution(self):
        for record in self:
            if record.analytic_distribution_stored_char:
                distribution_to_return = {}
                distribution_json = json.loads(record.analytic_distribution_stored_char)
                for account, distribution in distribution_json.items():
                    distribution_to_return[int(account)] = float(distribution)
                # Check if the account exists, can be removed when we have a constraint between account and model
                account_ids = self.env['account.analytic.account'].browse(distribution_to_return.keys()).exists().ids
                record.analytic_distribution = {account_id: distribution_to_return[account_id] for account_id in account_ids}

    @api.onchange('analytic_distribution')
    def _inverse_analytic_distribution(self):
        decimal_precision = self.env['decimal.precision'].precision_get('Percentage Analytic')
        self.env.remove_to_compute(self._fields['analytic_distribution_stored_char'], self)
        for record in self:
            if not record.analytic_distribution:
                record.analytic_distribution_stored_char = None
            else:
                distribution_to_return = {}
                for account, distribution in record.analytic_distribution.items():
                    distribution_to_return[account] = float_repr(distribution, decimal_precision)
                record.analytic_distribution_stored_char = json.dumps(distribution_to_return)

    @api.depends('analytic_distribution_stored_char')
    def _compute_plans_and_distribution(self):
        for record in self:
            plans = self.env['account.analytic.plan'].get_relevant_plans(**record._get_plan_params())
            widget_data = {
                plan['id']: plan
                for plan in plans}
            if record.analytic_distribution_stored_char:
                distribution_to_return = {}
                distribution_json = json.loads(record.analytic_distribution_stored_char)
                for account, distribution in distribution_json.items():
                    distribution_to_return[int(account)] = float(distribution)
                account_ids = self.env['account.analytic.account'].browse(distribution_to_return.keys())
                for analytic_account in account_ids:
                    widget_data[analytic_account.root_plan_id.id]['distribution'].append({
                        "analytic_account_id": analytic_account.id,
                        "percentage": distribution_to_return[analytic_account.id],
                        "id": analytic_account.id,
                        "group_id": analytic_account.root_plan_id.id,
                        "analytic_account_name": analytic_account.name,
                        "color": analytic_account.color,
                    })
            record.analytic_distribution_widget = widget_data

    def _inverse_plans_and_distribution(self):
        decimal_precision = self.env['decimal.precision'].precision_get('Percentage Analytic')
        self.env.remove_to_compute(self._fields['analytic_distribution_stored_char'], self)
        for record in self:
            print('saving distribution', record.analytic_distribution_widget)
            plan_distributions = { dist['analytic_account_id']: dist['percentage']
                                    for plan in record.analytic_distribution_widget.values()
                                    for dist in plan['distribution']}
            print('combined distributions', plan_distributions)
            record.analytic_distribution = plan_distributions
