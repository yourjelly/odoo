# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, api, _


class SaleOrder(models.Model):
    _inherit = "sale.order"

    repair_order_ids = fields.One2many('repair.order', 'sale_order_id')

    def action_open_repair_orders(self):
        self.ensure_one()
        action = {
            'res_model': 'repair.order',
            'type': 'ir.actions.act_window',
        }
        if len(self.repair_order_ids) == 1:
            action.update({
                'view_mode': 'form',
                'res_id': self.repair_order_ids[0].id,
            })
        else:
            action.update({
                'name': _("Repair Orders of %s", self.name),
                'domain': [('id', 'in', self.repair_order_ids.ids)],
                'view_mode': 'tree,form',
            })
        return action

    def _action_confirm(self):
        res = super()._action_confirm()

        # Create repair orders (only one max by sale order, if multiple create_repair, add fee rapair line instead)
        repairs_values = []
        for sale in self:
            repair_lines = sale.order_line.filtered(lambda l: l.product_id.create_repair_order)
            if not repair_lines:
                continue
            repair_val = {}
            for line in repair_lines:
                if not repair_val:
                    repair_val = line._prepare_repair_order_values()
                else:
                    repair_val['fees_lines'].append(line._prepare_repair_fee_values())
            repair_lines.is_repair_line = True
            repairs_values.append(repair_val)
        self.env['repair.order'].create(repairs_values)

        sale.repair_order_ids.filtered(lambda r: r.state == 'draft').action_repair_confirm()

        return res


class SaleOrderLine(models.Model):
    _inherit = "sale.order.line"

    repair_fee_id = fields.Many2one('repair.fee')
    repair_line_id = fields.Many2one('repair.line')

    def _action_launch_stock_rule(self):
        # Avoid launch stock rule if line is_repair_line
        normal_lines = self.filtered(lambda l: not (l.repair_fee_id or l.repair_line_id))
        return super(SaleOrderLine, normal_lines)._action_launch_stock_rule()

    def _prepare_repair_fee_values(self):
        return {
            'name': self.name.split('\n', maxsplit=1),
            'product_id': self.product_id.id,
            'product_uom_qty': self.product_uom_qty,
            'price_unit': self.price_unit,
            'product_uom': self.product_uom.id,
            'tax_id': self.tax_id.ids
        }

    def _prepare_repair_order_values(self):
        self.ensure_one()
        return {
            'description': self.name.split('\n', maxsplit=1),
            'quotation_notes': self.name,
            'partner_id': self.order_id.partner_id.id,
            'sale_order_id': self.order_id.id,
            'pricelist_id': self.order_id.pricelist_id.id,
            'company_id': self.company_id.id,
            'fees_lines': [(0, 0, self._prepare_repair_fee_values())]
        }
