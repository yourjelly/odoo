# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from ast import literal_eval
from collections import defaultdict

from odoo import api, fields, models, _
from odoo.tools import float_round


class MrpProduction(models.Model):
    _name = 'mrp.production'
    _inherit = ['mrp.production', 'analytic.mixin']

    extra_cost = fields.Float(copy=False, string='Extra Unit Cost')
    show_valuation = fields.Boolean(compute='_compute_show_valuation')
    analytic_account_ids = fields.Many2many('account.analytic.account', compute='_compute_analytic_account_ids', store=True)
    move_wip_ids = fields.One2many('stock.move', 'wip_production_id', 'Components (WIP posted)', copy=False)

    def _compute_show_valuation(self):
        for order in self:
            order.show_valuation = any(m.state == 'done' for m in order.move_finished_ids | order.move_wip_ids)

    @api.depends('bom_id', 'product_id')
    def _compute_analytic_distribution(self):
        for record in self:
            if record.bom_id.analytic_distribution:
                record.analytic_distribution = record.bom_id.analytic_distribution
            else:
                record.analytic_distribution = record.env['account.analytic.distribution.model']._get_distribution({
                    "product_id": record.product_id.id,
                    "product_categ_id": record.product_id.categ_id.id,
                    "company_id": record.company_id.id,
                })

    @api.depends('analytic_distribution')
    def _compute_analytic_account_ids(self):
        for record in self:
            record.analytic_account_ids = bool(record.analytic_distribution) and self.env['account.analytic.account'].browse(
                list({int(account_id) for ids in record.analytic_distribution for account_id in ids.split(",")})
            ).exists()

    @api.constrains('analytic_distribution')
    def _check_analytic(self):
        for record in self:
            params = {'business_domain': 'manufacturing_order', 'company_id': record.company_id.id}
            if record.product_id:
                params['product'] = record.product_id.id
            record.with_context({'validate_analytic': True})._validate_distribution(**params)

    def write(self, vals):
        res = super().write(vals)
        for production in self:
            if vals.get('name'):
                production.move_raw_ids.analytic_account_line_ids.ref = production.display_name
                for workorder in production.workorder_ids:
                    workorder.mo_analytic_account_line_ids.ref = production.display_name
                    workorder.mo_analytic_account_line_ids.name = _("[WC] %s", workorder.display_name)
            if 'analytic_distribution' in vals and production.state != 'draft':
                production.move_raw_ids._account_analytic_entry_move()
                production.workorder_ids._create_or_update_analytic_entry()
        return res

    def action_view_stock_valuation_layers(self):
        self.ensure_one()
        domain = [('id', 'in', (self.move_raw_ids + self.move_finished_ids + self.scrap_ids.move_ids + self.move_wip_ids).stock_valuation_layer_ids.ids)]
        action = self.env["ir.actions.actions"]._for_xml_id("stock_account.stock_valuation_layer_action")
        context = literal_eval(action['context'])
        context.update(self.env.context)
        context['no_at_date'] = True
        context['search_default_group_by_product_id'] = False
        return dict(action, domain=domain, context=context)

    def action_view_analytic_accounts(self):
        self.ensure_one()
        return {
            "type": "ir.actions.act_window",
            "res_model": "account.analytic.account",
            'domain': [('id', 'in', self.analytic_account_ids.ids)],
            "name": _("Analytic Accounts"),
            'view_mode': 'tree,form',
        }

    def _cal_price(self, consumed_moves):
        """Set a price unit on the finished move according to `consumed_moves`.
        """
        super(MrpProduction, self)._cal_price(consumed_moves)
        finished_move = self.move_finished_ids.filtered(
            lambda x: x.product_id == self.product_id and x.state not in ('done', 'cancel') and x.quantity > 0)
        if finished_move:
            finished_move.ensure_one()
            byproduct_moves = self.move_byproduct_ids.filtered(lambda m: m.state not in ('done', 'cancel') and m.quantity > 0)
            if (finished_move.product_id.valuation == 'real_time' and finished_move.product_id.cost_method in ('fifo', 'average')
                    and all((p.valuation == 'real_time' and p.cost_method in ('fifo', 'average')) for p in byproduct_moves.product_id)):
                self._post_labour()
                work_center_cost = sum(self.workorder_ids.time_ids.account_move_line_id.mapped('balance'))
            else:
                work_center_cost = sum(wo._cal_cost() for wo in self.workorder_ids)
            quantity = finished_move.product_uom._compute_quantity(
                finished_move.quantity, finished_move.product_id.uom_id)
            extra_cost = self.extra_cost * quantity
            total_cost = - sum(consumed_moves.sudo().stock_valuation_layer_ids.mapped('value')) + work_center_cost + extra_cost
            byproduct_cost_share = 0
            for byproduct in byproduct_moves:
                if byproduct.cost_share == 0:
                    continue
                byproduct_cost_share += byproduct.cost_share
                if byproduct.product_id.cost_method in ('fifo', 'average'):
                    byproduct.price_unit = total_cost * byproduct.cost_share / 100 / byproduct.product_uom._compute_quantity(byproduct.quantity, byproduct.product_id.uom_id)
            if finished_move.product_id.cost_method in ('fifo', 'average'):
                finished_move.price_unit = total_cost * float_round(1 - byproduct_cost_share / 100, precision_rounding=0.0001) / quantity
        return True

    def _get_backorder_mo_vals(self):
        res = super()._get_backorder_mo_vals()
        res['extra_cost'] = self.extra_cost
        return res

    def _post_labour(self):
        """
            Creates and posts an account move crediting the COP account and debiting the different expense accounts
            linked to the workcenters on the different workorders on the MOs.
            Any productivity logs already posted via WIP will be credited on the WIP account instead of the COP account.
        """
        product_accounts = self.product_id.product_tmpl_id.get_product_accounts()
        labour_amounts_non_wip = defaultdict(float)
        time_ids_non_wip = defaultdict(self.env['mrp.workcenter.productivity'].browse)
        labour_amounts_wip = []  # (acc, amt, time_ids)
        for wo in self.workorder_ids:
            account = wo.workcenter_id.expense_account_id or product_accounts['expense']
            labour_amounts_non_wip[account] += wo._cal_cost([('account_move_line_id', '=', False)])
            time_ids_non_wip[account] |= wo.time_ids.filtered_domain([('account_move_line_id', '=', False)])
            wip_amount = sum(wo.time_ids.account_move_line_id.mapped('balance'))
            if wip_amount:
                labour_amounts_wip.append((account, wip_amount, wo.time_ids.filtered_domain([('account_move_line_id', '!=', False)])))

        self._create_labour_move(
            [(acc, amt, time_ids_non_wip[acc]) for acc, amt in labour_amounts_non_wip.items()],
            self._get_cop_account(),
        )  # non WIP, grouped by expense account

        if labour_amounts_wip:
            self._create_labour_move(
                labour_amounts_wip,
                self._get_wip_account(),
            )  # WIP, grouped by WO

    def _post_labour_wip(self):
        """
            Post labor to WIP account, only taking into account time entries that have not already been posted to WIP.
            An account move is created, crediting the COP account and debiting the WIP account.
            A separate credit account move line is created for each relevant work order.
            This is to ensure that upon marking the MO as done, the WIP amounts can be properly transferred to the
            correct expense accounts that will be set on the relevant workcenter at that time.
        """
        for mo in self:
            if mo.with_company(mo.company_id).product_id.valuation != 'real_time':
                continue

            wip_account = mo._get_wip_account()
            mo._create_labour_move(
                [(
                    wip_account,
                    wo._cal_cost([('account_move_line_id', '=', False)]),
                    wo.time_ids.filtered_domain([('account_move_line_id', '=', False)])
                ) for wo in mo.workorder_ids],
                mo._get_cop_account(),
            )

    def button_mark_done(self):
        for wip_move in self.move_wip_ids:
            wip_move.copy({
                'location_id': wip_move.location_dest_id.id,
                'location_dest_id': wip_move.wip_production_id.production_location_id.id,
                'wip_production_id': False,
                'raw_material_production_id': wip_move.wip_production_id.id,
                'move_orig_ids': wip_move.ids,
            })
        return super().button_mark_done()

    def action_post_wip(self):
        # Only split moves that have picked move lines
        moves_to_split = self.move_raw_ids.move_line_ids.filtered(lambda ml: ml.picked).mapped('move_id')
        
        # Change location + mark as done (will create backorder)
        moves_to_split.location_dest_id = self.picking_type_id.production_wip_location
        done_moves = moves_to_split._action_done()
        done_moves.wip_production_id = done_moves.raw_material_production_id
        done_moves.raw_material_production_id = False
        self._post_labour_wip()

    def _create_labour_move(self, line_data, counter_account):
        """
            An account move is created and posted with different debit lines matching the provided line_data accounts,
            amounts and productivity records. A balancing credit line is added with the provided counter_account.
        """
        self.ensure_one()
        total_cost = sum(self.company_id.currency_id.round(i[1]) for i in line_data)
        if self.company_id.currency_id.is_zero(total_cost):
            return
        desc = _('%s - Labour', self.name)
        line_data.append((counter_account, -total_cost, self.env['mrp.workcenter.productivity']))
        self.env['account.move'].sudo().create({
            'journal_id': self.product_id.product_tmpl_id.get_product_accounts()['stock_journal'].id,
            'date': fields.Date.context_today(self),
            'ref': desc,
            'move_type': 'entry',
            'line_ids': [(0, 0, {
                'name': desc,
                'ref': desc,
                'balance': amt,
                'account_id': acc.id,
                'productivity_ids': time_ids.ids,
            }) for acc, amt, time_ids in line_data if not self.company_id.currency_id.is_zero(amt)]
        })._post()

    def _get_cop_account(self):
        self.ensure_one()
        return self.env['account.account'].browse(self.move_finished_ids[0]._get_src_account(
            self.product_id.product_tmpl_id.get_product_accounts()
        ))

    def _get_wip_account(self):
        self.ensure_one()
        return (self.move_wip_ids.location_dest_id or self.picking_type_id.production_wip_location).valuation_out_account_id
