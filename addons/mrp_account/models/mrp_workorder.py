# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, _


class MrpWorkorder(models.Model):
    _inherit = 'mrp.workorder'

    mo_analytic_account_line_id = fields.Many2one('account.analytic.line')
    wc_analytic_account_line_id = fields.Many2one('account.analytic.line')

    def write(self, vals):
        res = super().write(vals)
        if 'duration' in vals:
            self._create_or_update_analytic_entry()
        return res

    def _action_confirm(self):
        super()._action_confirm()
        self._create_or_update_analytic_entry()

    def action_cancel(self):
        (self.mo_analytic_account_line_id | self.wc_analytic_account_line_id).unlink()
        super().action_cancel()

    def _prepare_analytic_line(self, account, qty, val):
        self.ensure_one()
        return {
            'name': _("[WC] %(name)s", name=self.name),
            'amount': val,
            'account_id': account.id,
            'unit_amount': qty,
            'product_id': self.product_id.id,
            'product_uom_id': self.product_id.uom_id.id,
            'company_id': self.company_id.id,
            'category': 'manufacturing_order',
        }

    def _create_or_update_analytic_entry(self):
        AccountAnalyticLine = self.env['account.analytic.line'].sudo()
        for wo in self.filtered(lambda wo: wo.production_id.analytic_account_id or wo.workcenter_id.costs_hour_account_id):
            hours = wo.duration / 60.0
            value = -hours * wo.workcenter_id.costs_hour
            mo_account = wo.production_id.analytic_account_id
            wc_account = wo.workcenter_id.costs_hour_account_id
            if mo_account:
                if wo.mo_analytic_account_line_id:
                    wo.mo_analytic_account_line_id.write({
                        'unit_amount': hours,
                        'amount': value,
                    })
                else:
                    wo.mo_analytic_account_line_id = AccountAnalyticLine.create(wo._prepare_analytic_line(mo_account, hours, value))
            if wc_account and wc_account != mo_account:
                if wo.wc_analytic_account_line_id:
                    wo.wc_analytic_account_line_id.write({
                        'unit_amount': hours,
                        'amount': value,
                    })
                else:
                    wo.wc_analytic_account_line_id = AccountAnalyticLine.create(wo._prepare_analytic_line(wc_account, hours, value))
