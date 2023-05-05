# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models
from odoo.tools.float_utils import float_compare, float_is_zero

from collections import defaultdict


class AccountMoveLine(models.Model):
    _inherit = 'account.move.line'

    def _get_valued_in_moves(self):
        self.ensure_one()
        return self.purchase_line_id.move_ids.filtered(
            lambda m: m.state == 'done' and m.product_qty != 0)

    def _get_out_and_not_invoiced_qty(self, in_moves):
        self.ensure_one()
        if not in_moves:
            return 0
        aml_qty = self.product_uom_id._compute_quantity(self.quantity, self.product_id.uom_id)
        invoiced_qty = sum(line.product_uom_id._compute_quantity(line.quantity, line.product_id.uom_id)
                           for line in self.purchase_line_id.invoice_lines - self)
        layers = in_moves.stock_valuation_layer_ids
        layers_qty = sum(layers.mapped('quantity'))
        out_qty = layers_qty - sum(layers.mapped('remaining_qty'))
        total_out_and_not_invoiced_qty = max(0, out_qty - invoiced_qty)
        out_and_not_invoiced_qty = min(aml_qty, total_out_and_not_invoiced_qty)
        return self.product_id.uom_id._compute_quantity(out_and_not_invoiced_qty, self.product_uom_id)

    def _get_price_diff_account(self):
        self.ensure_one()
        if self.product_id.cost_method == 'standard':
            return False
        accounts = self.product_id.product_tmpl_id.get_product_accounts(fiscal_pos=self.move_id.fiscal_position_id)
        return accounts['expense']

    def _create_in_invoice_svl(self):
        svl_vals_list = []
        for line in self:
            line = line.with_company(line.company_id)
            move = line.move_id.with_company(line.move_id.company_id)
            po_line = line.purchase_line_id
            uom = line.product_uom_id or line.product_id.uom_id

            # Don't create value for more quantity than received
            quantity = po_line.qty_received - (po_line.qty_invoiced - line.quantity)
            quantity = max(min(line.quantity, quantity), 0)
            if float_is_zero(quantity, precision_rounding=uom.rounding):
                continue

            layers = line._get_valued_in_moves().stock_valuation_layer_ids
            # if not layers and line.is_refund:
            #     reversed_move = move.reversed_entry_id
            #     layers = line._get_stock_valuation_layers(reversed_move)

            if not layers:
                continue

            price_unit = line._get_gross_unit_price()
            price_unit = line.currency_id._convert(price_unit, line.company_id.currency_id, line.company_id, line.date, round=False)
            price_unit = line.product_uom_id._compute_price(price_unit, line.product_id.uom_id)
            layers_price_unit = line._get_stock_valuation_layers_price_unit(layers)
            layers_to_correct = line._get_stock_layer_price_difference(layers, layers_price_unit, price_unit)
            svl_vals_list += line._prepare_in_invoice_svl_vals(layers_to_correct)
        return self.env['stock.valuation.layer'].sudo().create(svl_vals_list)

    def _get_stock_valuation_layers_price_unit(self, layers):
        price_unit_by_layer = {}
        for layer in layers:
            price_unit_by_layer[layer] = layer.value / layer.quantity
        return price_unit_by_layer

    def _get_stock_layer_price_difference(self, layers, layers_price_unit, price_unit):
        self.ensure_one()
        po_line = self.purchase_line_id
        product_uom = self.product_id.uom_id
        posted_invoices = po_line.invoice_lines.move_id._sort_by_posted_time()
        qty_to_invoice_per_layer = {layer: abs(layer.quantity) for layer in layers}

        # the next dict is a matrix [layer L, invoice I] where each cell gives two info:
        # [initial qty of L invoiced by I, remaining invoiced qty]
        layers_and_invoices_qties = defaultdict(lambda: [0, 0])

        # Replay the whole history: we want to know what are the layers used by each invoice
        # and then the ones used by `self`
        for aml in posted_invoices.line_ids | self:
            if aml.purchase_line_id != po_line:
                continue
            invoice = aml.move_id
            aml_qty = aml.product_uom_id._compute_quantity(aml.quantity, product_uom)
            if aml.is_refund:
                sign = -1
                reversed_invoice = aml.move_id.reversed_entry_id
                if reversed_invoice:
                    impacted_invoice = reversed_invoice
                    # it's a refund, therefore we can only consume the quantities invoiced by
                    # the initial invoice (`reversed_invoice`)
                    layers_to_consume = []
                    for layer in layers:
                        remaining_invoiced_qty = layers_and_invoices_qties[(layer, reversed_invoice)][1]
                        layers_to_consume.append((layer, remaining_invoiced_qty))
                else:
                    # we want the available out-layers
                    layers_to_consume = []
                    for layer in qty_to_invoice_per_layer:
                        if layer.stock_move_id._is_out():
                            layers_to_consume.append((layer, qty_to_invoice_per_layer[layer]))

            else:
                sign = 1
                layers_to_consume = []
                for layer in qty_to_invoice_per_layer:
                    if layer.stock_move_id._is_in():
                        layers_to_consume.append((layer, qty_to_invoice_per_layer[layer]))
                impacted_invoice = False
            while float_compare(aml_qty, 0, precision_rounding=product_uom.rounding) > 0 and layers_to_consume:
                layer, layer_qty = layers_to_consume[0]
                layers_to_consume = layers_to_consume[1:]
                if float_is_zero(layer_qty, precision_rounding=product_uom.rounding):
                    continue
                common_qty = min(aml_qty, layer_qty)
                aml_qty -= common_qty
                qty_to_invoice_per_layer[layer] -= sign * common_qty
                layers_and_invoices_qties[(layer, invoice)] = [common_qty, common_qty]
                layers_and_invoices_qties[(layer, impacted_invoice)][1] -= common_qty

        # Now we know what layers does `self` use, let's check if we have to create a pdiff SVL
        # (or cancel such an SVL in case of a refund)
        invoice = self.move_id
        layers_to_correct = dict()
        for layer in layers:
            layer_qty = layer.quantity
            invoicing_layer_qty = layers_and_invoices_qties[(layer, invoice)][1]
            if float_is_zero(invoicing_layer_qty, precision_rounding=product_uom.rounding):
                continue
            out_layer_qty = layer_qty - layer.remaining_qty
            if self.is_refund:
                sign = -1
                reversed_invoice = invoice.reversed_entry_id
                if not reversed_invoice:
                    # this is a refund for a returned quantity, we don't have anything to do
                    continue
                initial_invoiced_qty = layers_and_invoices_qties[(layer, reversed_invoice)][0]
                initial_pdiff_svl = layer.stock_valuation_layer_ids.filtered(lambda svl: svl.account_move_line_id.move_id == reversed_invoice)
                if not initial_pdiff_svl or float_is_zero(initial_invoiced_qty, precision_rounding=product_uom.rounding):
                    continue
                previously_invoiced_qty = 0
                for previous_invoice in posted_invoices:
                    if previous_invoice == reversed_invoice:
                        break
                    previously_invoiced_qty += layers_and_invoices_qties[(layer, previous_invoice)][0]
                # we don't want to cancel a pdiff SVL of an already-delivered qty
                qty_to_skip = max(0, out_layer_qty - previously_invoiced_qty)
                qty_to_correct = max(0, invoicing_layer_qty - qty_to_skip)
                # negative qty because we are cancelling an existing pdiff SVL
                unit_valuation_difference = initial_pdiff_svl.value / initial_invoiced_qty
                price_difference_curr = initial_pdiff_svl.price_diff_value / initial_invoiced_qty
            else:
                sign = 1
                # get the invoiced qty of the layer without considering `self`
                invoiced_layer_qty = layer_qty - qty_to_invoice_per_layer[layer] - invoicing_layer_qty
                # skip the qty not invoiced but already out
                qty_to_skip = max(0, out_layer_qty - invoiced_layer_qty)
                qty_to_correct = max(0, invoicing_layer_qty - qty_to_skip)
                unit_valuation_difference = price_unit - layers_price_unit[layer]
                po_pu_curr = po_line.currency_id._convert(po_line.price_unit, self.currency_id, self.company_id, self.date, round=False)
                price_difference_curr = po_pu_curr - self._get_gross_unit_price()
            if float_is_zero(unit_valuation_difference * qty_to_correct, precision_rounding=self.company_id.currency_id.rounding):
                continue
            layers_to_correct[layer] = (sign * qty_to_correct, unit_valuation_difference, price_difference_curr)

        return layers_to_correct

    def _prepare_in_invoice_svl_vals(self, layers_correction):
        svl_vals_list = []
        invoiced_qty = self.quantity
        common_svl_vals = {
            'account_move_id': self.move_id.id,
            'account_move_line_id': self.id,
            'company_id': self.company_id.id,
            'product_id': self.product_id.id,
            'quantity': 0,
            'unit_cost': 0,
            'remaining_qty': 0,
            'remaining_value': 0,
            'description': self.move_id.name and '%s - %s' % (self.move_id.name, self.product_id.name) or self.product_id.name,
        }
        for layer, (quantity, price_difference, price_difference_curr) in layers_correction.items():
            svl_vals = self.product_id._prepare_in_svl_vals(quantity, price_difference)
            diff_value_curr = self.currency_id.round(price_difference_curr * quantity)
            svl_vals.update(**common_svl_vals, stock_valuation_layer_id=layer.id, price_diff_value=diff_value_curr)
            svl_vals_list.append(svl_vals)
            # Adds the difference into the last SVL's remaining value.
            layer.remaining_value += svl_vals['value']
            if float_compare(invoiced_qty, 0, self.product_id.uom_id.rounding) <= 0:
                break

        return svl_vals_list
