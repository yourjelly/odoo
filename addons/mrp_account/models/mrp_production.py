# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from ast import literal_eval
from copy import deepcopy

from odoo import api, fields, models, _
from odoo.tools import float_is_zero


class MrpProductionWorkcenterLineTime(models.Model):
    _inherit = 'mrp.workcenter.productivity'

    cost_already_recorded = fields.Boolean('Cost Recorded', help="Technical field automatically checked when a ongoing production posts journal entries for its costs. This way, we can record one production's cost multiple times and only consider new entries in the work centers time lines.")


class MrpProduction(models.Model):
    _inherit = 'mrp.production'

    extra_cost = fields.Float(copy=False, help='Extra cost per produced unit')
    show_valuation = fields.Boolean(compute='_compute_show_valuation')
    analytic_account_id = fields.Many2one('account.analytic.account', 'Analytic Account', copy=True, company_dependent=True,
        help="Analytic account in which cost and revenue entries will take place for financial management of the manufacturing order.")

    def _compute_show_valuation(self):
        for order in self:
            order.show_valuation = any(m.state == 'done' for m in order.move_finished_ids)

    @api.onchange('bom_id')
    def _onchange_bom_id(self):
        self.analytic_account_id = self.bom_id.analytic_account_id

    def _cal_price(self, consumed_moves):
        """Set a price unit on the finished move according to `consumed_moves`.
        """
        super(MrpProduction, self)._cal_price(consumed_moves)
        work_center_cost = 0
        finished_move = self.move_finished_ids.filtered(lambda x: x.product_id == self.product_id and x.state not in ('done', 'cancel') and x.quantity_done > 0)
        if finished_move:
            finished_move.ensure_one()
            for work_order in self.workorder_ids:
                time_lines = work_order.time_ids.filtered(lambda x: x.date_end and not x.cost_already_recorded)
                duration = sum(time_lines.mapped('duration'))
                time_lines.write({'cost_already_recorded': True})
                work_center_cost += (duration / 60.0) * work_order.workcenter_id.costs_hour
            if finished_move.product_id.cost_method in ('fifo', 'average'):
                qty_done = finished_move.product_uom._compute_quantity(finished_move.quantity_done, finished_move.product_id.uom_id)
                extra_cost = self.extra_cost * qty_done
                finished_move.price_unit = (sum([-m.stock_valuation_layer_ids.value for m in consumed_moves.sudo()]) + work_center_cost + extra_cost) / qty_done
        return True

    def _prepare_wc_analytic_line(self, wc_line):
        wc = wc_line.workcenter_id
        hours = wc_line.duration / 60.0
        value = hours * wc.costs_hour
        account = wc.costs_hour_account_id.id
        return {
            'name': _("[WC] %(name)s", name=wc_line.name),
            'amount': -value,
            'account_id': account,
            'ref': wc.code,
            'unit_amount': hours,
            'company_id': self.company_id.id,
        }

    def _costs_generate(self):
        """ Calculates total costs at the end of the production.
        """
        self.ensure_one()
        # we use SUPERUSER_ID as we do not guarantee an mrp user
        # has access to account analytic lines but still should be
        # able to produce orders
        AccountAnalyticLine = self.env['account.analytic.line'].sudo()
        mo_precision_rounding = self.analytic_account_id.currency_id.rounding
        vals_list = []
        for wc_line in self.workorder_ids:
            if self.analytic_account_id or wc_line.workcenter_id.costs_hour_account_id:
                vals = self._prepare_wc_analytic_line(wc_line)
                # for work center analytic account
                wc_precision_rounding = wc_line.workcenter_id.costs_hour_account_id.currency_id.rounding
                if wc_precision_rounding and not float_is_zero(vals.get('amount', 0.0), precision_rounding=wc_precision_rounding):
                    vals_list.append(vals)
                # for mo analytic account
                if mo_precision_rounding and \
                   self.analytic_account_id != wc_line.workcenter_id.costs_hour_account_id and \
                   not float_is_zero(vals.get('amount', 0.0), precision_rounding=mo_precision_rounding):
                    new_vals = deepcopy(vals)
                    new_vals.update({
                        'account_id': self.analytic_account_id.id,
                    })
                    vals_list.append(new_vals)
        AccountAnalyticLine.create(vals_list)

    def _get_backorder_mo_vals(self):
        res = super()._get_backorder_mo_vals()
        res['extra_cost'] = self.extra_cost
        return res

    def button_mark_done(self):
        res = super(MrpProduction, self).button_mark_done()
        for order in self.filtered(lambda mo: mo.state == "done"):
            order._costs_generate()
        return res

    def action_view_stock_valuation_layers(self):
        self.ensure_one()
        domain = [('id', 'in', (self.move_raw_ids + self.move_finished_ids + self.scrap_ids.move_id).stock_valuation_layer_ids.ids)]
        action = self.env["ir.actions.actions"]._for_xml_id("stock_account.stock_valuation_layer_action")
        context = literal_eval(action['context'])
        context.update(self.env.context)
        context['no_at_date'] = True
        context['search_default_group_by_product_id'] = False
        return dict(action, domain=domain, context=context)
