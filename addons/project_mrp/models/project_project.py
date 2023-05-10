# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import json
from odoo import fields, models, _lt
from odoo.osv import expression


class Project(models.Model):
    _inherit = "project.project"

    production_count = fields.Integer(related="analytic_account_id.production_count", groups='mrp.group_mrp_user')
    workorder_count = fields.Integer(related="analytic_account_id.workorder_count", groups='mrp.group_mrp_user')
    bom_count = fields.Integer(related="analytic_account_id.bom_count", groups='mrp.group_mrp_user')

    def action_view_mrp_production(self):
        self.ensure_one()
        action = self.env['ir.actions.actions']._for_xml_id('mrp.mrp_production_action')
        action['domain'] = [('analytic_account_id', '=', self.analytic_account_id.id)]
        action['context'] = {'default_analytic_account_id': self.analytic_account_id.id}
        if self.production_count == 1:
            action['view_mode'] = 'form'
            action['res_id'] = self.analytic_account_id.production_ids.id
            if 'views' in action:
                action['views'] = [
                    (view_id, view_type)
                    for view_id, view_type in action['views']
                    if view_type == 'form'
                ] or [False, 'form']
        return action

    def action_view_mrp_bom(self):
        self.ensure_one()
        action = self.analytic_account_id.action_view_mrp_bom()
        if self.bom_count > 1:
            action['view_mode'] = 'tree,form,kanban'
        return action

    def action_view_workorder(self):
        self.ensure_one()
        action = self.analytic_account_id.action_view_workorder()
        if self.workorder_count > 1:
            action['view_mode'] = 'tree,form,kanban,calendar,pivot,graph'
        return action

    # ----------------------------
    #  Project Updates
    # ----------------------------

    def _get_profitability_labels(self):
        labels = super()._get_profitability_labels()
        labels['manufacturing_order'] = _lt('Manufacturing Orders')
        return labels

    def _get_profitability_sequence_per_invoice_type(self):
        sequence_per_invoice_type = super()._get_profitability_sequence_per_invoice_type()
        sequence_per_invoice_type['manufacturing_order'] = 10
        return sequence_per_invoice_type

    def _get_profitability_aal_domain(self):
        return expression.AND([
            super()._get_profitability_aal_domain(),
            [('category', '!=', 'manufacturing_order')],
        ])

    def _get_manufacturing_profitability_items(self,with_action=True):
        section_id = 'manufacturing_order'
        count, amount_sum = self.env['account.analytic.line'].sudo()._read_group(
            [('account_id', 'in', self.analytic_account_id.ids), ('category', '=', section_id)],
            aggregates=['__count', 'amount:sum'],
        )[0]
        print("\n\n\n\n-----------amount_sum--------------",amount_sum)
        if count:
            if not self.analytic_account_id:
                return {}
            can_see_mrp = with_action and self.user_has_groups('mrp.group_mrp_user')
            query = self.env['mrp.production']._search([('state', '=', 'done')])
            query.add_where('mrp_production.analytic_account_id = %s', [str(self.analytic_account_id.id)])
            query_string, query_param = query.select('array_agg(id) as ids')
            self._cr.execute(query_string, query_param)
            mrp_read_group = [mrp for mrp in self._cr.dictfetchall()]
            if not mrp_read_group or not mrp_read_group[0].get('ids'):
                return {}
            mrp_data = mrp_read_group[0]
            mrp_profitability_items = {
                'costs': {'id': section_id, 'sequence': self._get_profitability_sequence_per_invoice_type()[section_id], 'billed': amount_sum, 'to_bill': 0.0},
            }
            if can_see_mrp:
                args = [section_id, [('id', 'in', mrp_data['ids'])]]
                if mrp_data['ids']:
                    args.append(mrp_data['ids'])
                action = {'name': 'action_view_mrp_production', 'type': 'object', 'args': json.dumps(args)}
                mrp_profitability_items['action'] = action
            print("\n\n\n----------mrp_profitability_items-------------",mrp_profitability_items)
            return mrp_profitability_items

    def _get_profitability_items(self, with_action=True):
        profitability_items = super()._get_profitability_items(with_action)
        expenses_data = self._get_manufacturing_profitability_items(with_action)
        if expenses_data:
            if 'revenues' in expenses_data:
                revenues = profitability_items['revenues']
                revenues['data'].append(expenses_data['revenues'])
                revenues['total'] = {k: revenues['total'][k] + expenses_data['revenues'][k] for k in ['invoiced', 'to_invoice']}
            costs = profitability_items['costs']
            costs['data'].append(expenses_data['costs'])
            costs['total'] = {k: costs['total'][k] + expenses_data['costs'][k] for k in ['billed', 'to_bill']}
        print("\n\n\n----------profitability_items-------------",profitability_items)
        return profitability_items
                # costs = profitability_items['costs']
                # # print("\n\n\n-------costs----------",costs)
                # costs['data'].append(mrp_profitability_items)
                # costs['total']['billed'] += amount_sum
        # mrp_category = 'manufacturing_order'
        # count, amount_sum = self.env['account.analytic.line'].sudo()._read_group(
        #     [('account_id', 'in', self.analytic_account_id.ids), ('category', '=', mrp_category)],
        #     aggregates=['__count', 'amount:sum'],
        # )[0]
        # if count:
        #     can_see_manufactoring_order = with_action and len(self) == 1 and self.user_has_groups('mrp.group_mrp_user')
        #     mrp_costs = {
        #         'id': mrp_category,
        #         'sequence': self._get_profitability_sequence_per_invoice_type()[mrp_category],
        #         'billed': amount_sum,
        #         'to_bill': 0.0,
        #     }
        #     if can_see_manufactoring_order:
        #         mrp_costs['action'] = {'name': 'action_view_mrp_production', 'type': 'object'}
        #     costs = profitability_items['costs']
        #     costs['data'].append(mrp_costs)
        #     costs['total']['billed'] += mrp_costs['billed']
        # return profitability_items

    def _get_stat_buttons(self):
        buttons = super(Project, self)._get_stat_buttons()
        if self.user_has_groups('mrp.group_mrp_user'):
            buttons.extend([{
                'icon': 'flask',
                'text': _lt('Bills of Materials'),
                'number': self.bom_count,
                'action_type': 'object',
                'action': 'action_view_mrp_bom',
                'show': self.bom_count > 0,
                'sequence': 35,
            }])
        return buttons
