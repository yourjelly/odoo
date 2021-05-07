# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, api, _


class SaleOrder(models.Model):
    _inherit = "sale.order"

    repair_order_id = fields.One2many('repair.order', 'sale_order_id')

    def action_open_repair_orders(self):
        self.ensure_one()
        action = {
            'res_model': 'repair.order',
            'type': 'ir.actions.act_window',
        }
        if len(self.repair_order_id) == 1:
            action.update({
                'view_mode': 'form',
                'res_id': self.repair_order_id[0],
            })
        else:
            action.update({
                'name': _("Repair Orders of %s", self.name),
                'domain': [('id', 'in', self.repair_order_id.ids)],
                'view_mode': 'tree,form',
            })
        return action

    def _action_confirm(self):
        res = super()._action_confirm()

        # Create repair orders
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
                    repair_val['fees_lines'].append(line._prepare_repair_order_values()['fees_lines'])
            repair_lines.is_repair_line = True
            repairs_values.append(repair_val)
        repair_orders = self.env['repair.order'].create(repairs_values)
        repair_orders.action_repair_confirm()

        return res


class SaleOrderLine(models.Model):
    _inherit = "sale.order.line"

    is_repair_line = fields.Boolean("Is repair line ?")

    def _action_launch_stock_rule(self):
        # Avoid launch stock rule if line is_repair_line
        normal_lines = self.filtered(lambda l: not l.order_id.repair_id)
        return super(SaleOrderLine, normal_lines)._action_launch_stock_rule()

    def _prepare_repair_order_values(self):
        self.ensure_one()
        return {
            'description': self.name.split('\n', maxsplit=1),
            'quotation_notes': self.name,
            'partner_id': self.order_id.partner_id,
            'sale_order_id': self.order_id.id,
            'pricelist_id': self.order_id.pricelist_id,
            'company_id': self.company_id,
            'fees_lines': [(0, 0, {  # TODO other method
                'name': self.name.split('\n', maxsplit=1),
                'product_id': self.product_id,
                'product_uom_qty': self.product_uom_qty,
                'price_unit': self.price_unit,
                'product_uom': self.product_uom,
                'tax_id': self.tax_id
            })]
        }
