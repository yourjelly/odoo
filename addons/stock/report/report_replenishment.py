# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models


class ReplenishmentReport(models.AbstractModel):
    _name = 'report.stock.report_product_product_replenishment'
    _description = "Stock Replenishment Report"

    @api.model
    def _product_domain(self, product_template_ids, product_variant_ids):
        domain = []
        if product_template_ids:
            domain += [('product_tmpl_id', 'in', product_template_ids)]
        elif product_variant_ids:
            domain += [('product_id', 'in', product_variant_ids)]
        return domain

    @api.model
    def _get_report_values(self, docids, data=None):
        docs = self._get_report_data(product_variant_ids=docids)
        docargs = {
            'data': data,
            'doc_ids': docids,
            'doc_model': 'product.product',
            'docs': docs,
        }
        return docargs

    def test(self):
        import pudb; pudb.set_trace()
        print("coucou")

    @api.model
    def _get_report_data(self, product_template_ids=False, product_variant_ids=False):
        """ TODO """
        res = {
            'product_templates': False,
            'product_variants': False,
        }
        if product_template_ids:
            product_templates = self.env['product.template'].browse(product_template_ids)
            res['product_templates'] = product_templates
            res['product_variants'] = product_templates.product_variant_ids
        if product_variant_ids:
            product_variants = self.env['product.product'].browse(product_variant_ids)
            res['product_variants'] = product_variants

        # Generates report lines.
        consuming_lines, replenishing_lines = self._get_report_line_values(
            product_template_ids=product_template_ids,
            product_variant_ids=product_variant_ids,
        )
        # Updates report lines, to link replenishment lines with consuming lines when it's possible.
        report_lines = self._link_report_lines(consuming_lines, replenishing_lines)
        # Sorts lines to have unavailable replenishment at the end of the report.
        # report_lines.sort(key=lambda line: line['replenishment_filled'], reverse=True)
        report_lines.sort(key=lambda line: bool(line['document_in']) or line['replenishment_filled'], reverse=True)

        products = self.env['product.template']
        if product_template_ids:
            products = self.env['product.template'].browse(product_template_ids)
            res['multiple_product'] = len(products.product_variant_ids) > 1
        elif product_variant_ids:
            products = self.env['product.product'].browse(product_variant_ids)
            res['multiple_product'] = len(products) > 1
        else:
            res['multiple_product'] = True
        # If the report will display lines for multiple products, sorts them by product.
        if res['multiple_product']:
            report_lines.sort(key=lambda line: line['product']['id'])
        res['lines'] = report_lines
        res['uom'] = products[:1].uom_id.name

        # Computes quantities.
        res['quantity_on_hand'] = sum(products.mapped('qty_available'))
        res['virtual_available'] = sum(products.mapped('virtual_available'))

        # Will keep the track of all the incoming/outgoing quantity from pending documents.
        domain = [
            ('state', '=', 'draft'),
            '|',
                ('product_tmpl_id', 'in', product_template_ids),
                ('product_id', 'in', product_variant_ids),
        ]
        qty_in, qty_out = 0, 0
        in_domain = [('picking_code', '=', 'incoming')] + domain
        incoming_moves = self.env['stock.move'].read_group(in_domain, ['product_qty'], 'product_id')
        if incoming_moves:
            qty_in = sum(move['product_qty'] for move in incoming_moves)
        out_domain = [('picking_code', '=', 'outgoing')] + domain
        outgoing_moves = self.env['stock.move'].read_group(out_domain, ['product_qty'], 'product_id')
        if outgoing_moves:
            qty_out = sum(move['product_qty'] for move in outgoing_moves)

        res['qty'] = {
            'in': qty_in,
            'out': qty_out,
        }
        res['draft_picking_qty'] = {
            'in': qty_in,
            'out': qty_out,
        }
        return res

    @api.model
    def _get_report_line_values(self, product_template_ids, product_variant_ids):
        """ TODO """
        consuming_lines = []
        replenish_lines = []
        move_domain = [
            ('state', 'not in', ['draft', 'cancel', 'done']),
            ('product_uom_qty', '!=', 0),
        ]
        # Adjusts domain to target product variant or product template.
        if product_variant_ids:
            move_domain += [('product_id', 'in', product_variant_ids)]
        elif product_template_ids:
            move_domain += [('product_tmpl_id', 'in', product_template_ids)]
        moves = self.env['stock.move'].search(move_domain)

        # Separates consuming and replenishing moves and sorts them by expected date.
        consuming_moves = moves.filtered(
            lambda move: move._is_consuming()
        ).sorted(lambda move: move.date_expected)
        replenishing_moves = moves.filtered(
            lambda move: move._is_replenishing()
        ).sorted(lambda move: move.date_expected)

        # Creates a report line for each move linked to a consuming document.
        for move in consuming_moves:
            move_data_common = {
                'document_in': False,
                'document_out': move._get_consuming_document(),
                'move_in': False,
                'move_out': False,
                'product': {
                    'id': move.product_id.id,
                    'display_name': move.product_id.display_name
                },
                'replenishment_filled': True,
                'uom_id': move.product_id.uom_id,
                'receipt_date': '',
                'delivery_date': move.date_expected or '',
                'is_late': False,
            }

            # Creates also a report line for each linked replenishment document.
            qty_to_process = move.product_qty
            qty_reserved = move.reserved_availability
            for move_origin in move.move_orig_ids:
                move_data = dict(move_data_common)
                quantity = min(move.product_qty, move_origin.product_qty)
                qty_to_process -= quantity
                qty_reserved -= quantity
                move_data['quantity'] = quantity
                if move_origin.date_expected:
                    move_data['receipt_date'] = move_origin.date_expected
                    if move.date_expected and move_origin.date_expected > move.date_expected:
                        move_data['is_late'] = True
                document_in = move_origin._get_replenishment_document()
                if document_in:
                    move_data['document_in'] = document_in
                consuming_lines.append(move_data)

            # The move has still quantities who aren't fulfilled by a document.
            while qty_to_process > 0:
                if qty_reserved > 0:
                    # Create a line for quantities reserved in stock.
                    move_data = dict(move_data_common)
                    move_data['quantity'] = qty_reserved
                    consuming_lines.append(move_data)
                    qty_to_process -= qty_reserved
                    qty_reserved = 0
                else:
                    # Create a line for remaining unreseved quantities.
                    move_data = dict(move_data_common)
                    move_data['quantity'] = qty_to_process
                    move_data['replenishment_filled'] = False
                    consuming_lines.append(move_data)
                    qty_to_process = 0

        # Creates a report line for each move linked to a replenishing document.
        for move in replenishing_moves:
            move_data_common = {
                'document_in': move._get_replenishment_document(),
                'document_out': False,
                'product': {
                    'id': move.product_id.id,
                    'display_name': move.product_id.display_name
                },
                'replenishment_filled': True,
                'uom_id': move.product_id.uom_id,
                'receipt_date': move.date_expected or '',
                'delivery_date': '',
                'is_late': False,
                'quantity': move.product_qty
            }
            replenish_lines.append(move_data_common)
        return consuming_lines, replenish_lines

    @api.model
    def _link_report_lines(self, consuming_lines, replenishing_lines):
        """ Checks if unlinked replenish lines can be associated with a consuming line.
        """
        linked_replenishing_lines = []
        for replenishing_line in replenishing_lines:
            qty_to_process = replenishing_line['quantity']
            for consuming_line in consuming_lines:
                if consuming_line['replenishment_filled'] or replenishing_line['product']['id'] != consuming_line['product']['id']:
                    continue
                if consuming_line['quantity'] <= qty_to_process:
                    # Enough quantity to fulfil the line.
                    # Updates the line's quantity and marks it as fulfilled.
                    consuming_line['document_in'] = replenishing_line['document_in']
                    consuming_line['replenishment_filled'] = True
                    consuming_line['receipt_date'] = replenishing_line['receipt_date']
                    if consuming_line['receipt_date'] and consuming_line['delivery_date']:
                        consuming_line['is_late'] = consuming_line['receipt_date'] > consuming_line['delivery_date']
                    qty_to_process -= min(consuming_line['quantity'], qty_to_process)
                    if qty_to_process <= 0:
                        break
                else:
                    # No enough quantity to fulfil the line. So:
                    # - Decreases the quantity on the line;
                    # - Creates an another fulfilled line with lesser quantity.
                    consuming_line['quantity'] -= qty_to_process
                    separate_consuming_line = consuming_line.copy()
                    separate_consuming_line.update(
                        quantity=qty_to_process,
                        replenishment_filled=True,
                        document_in=replenishing_line['document_in'],
                        receipt_date=replenishing_line['receipt_date'],
                    )
                    separate_consuming_line['is_late'] = separate_consuming_line['receipt_date'] > separate_consuming_line['delivery_date']
                    linked_replenishing_lines.append(separate_consuming_line)
                    qty_to_process = 0
                    break
            # If it still unassign quantity, create a report line for it.
            if qty_to_process:
                report_data = dict(replenishing_line)
                report_data['quantity'] = qty_to_process
                linked_replenishing_lines.append(report_data)

        return consuming_lines + linked_replenishing_lines


class ReplenishmentTemplateReport(models.AbstractModel):
    _name = 'report.stock.report_product_template_replenishment'
    _description = "Stock Replenishment Report"
    _inherit = 'report.stock.report_product_product_replenishment'

    @api.model
    def _get_report_values(self, docids, data=None):
        docs = self._get_report_data(product_template_ids=docids)
        docargs = {
            'data': data,
            'doc_ids': docids,
            'doc_model': 'product.product',
            'docs': docs,
        }
        return docargs
