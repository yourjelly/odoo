# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from collections import defaultdict

from odoo import _, api, models
from odoo.tools import float_compare, float_is_zero, format_date


class ReceptionReport(models.AbstractModel):
    _name = 'report.stock.report_reception'
    _description = "Stock Reception Report"

    @api.model
    def _get_report_values(self, docids, data=None):
        ''' This report is flexibly designed to work with both individual and batch incoming pickings.
        '''
        docids = self.env.context.get('default_picking_ids', docids)
        receipts = self.env['stock.picking'].search([('id', 'in', docids), ('picking_type_code', '=', 'incoming')])
        # ignore when someone tries to open report for a non-incoming picking
        if not receipts:
            return {'receipts': False}

        # incoming move qtys
        product_to_qty_expected = defaultdict(float)
        product_to_qty_done = defaultdict(float)
        for move in receipts.move_lines:
            if move.product_id.type != 'product':
                continue
            if move.state == 'done':
                product_to_qty_done[move.product_id] += move.quantity_done
            else:
                product_to_qty_expected[move.product_id] += move.product_qty

        # incoming move products
        product_ids = set()
        for product_id, qty in product_to_qty_expected.items():
            if float_is_zero(qty, precision_rounding=product_id.uom_id.rounding):
                continue
            product_ids.add(product_id.id)
        for product_id, qty in product_to_qty_done.items():
            if float_is_zero(product_to_qty_done[product_id], precision_rounding=product_id.uom_id.rounding):
                continue
            product_ids.add(product_id.id)
        product_ids = list(product_ids)

        # only match for outgoing moves in same warehouse
        warehouse = receipts[0].picking_type_id.warehouse_id
        wh_location_ids = [loc['id'] for loc in self.env['stock.location'].search_read(
            [('id', 'child_of', warehouse.view_location_id.id)],
            ['id'],
        )]

        outs = self.env['stock.move']
        # when reserving incoming moves, we auto-generate a report of the move(s) reserved otherwise
        # we have no way to trace the reservation => auto-generated reports expect move_ids
        if data and data.get('move_ids'):
            outs = outs.browse(data.get('move_ids'))
        else:
            outs = outs.search(
                [
                    ('state', 'in', ['confirmed', 'partially_available', 'waiting']),
                    ('product_qty', '>', 0),
                    ('location_id', 'in', wh_location_ids),
                    ('move_orig_ids', '=', False),
                    ('product_id', 'in', product_ids),
                    '|', ('picking_id.picking_type_code', '!=', 'incoming'),
                         ('picking_id', '=', False),
                ],
                order='reservation_date, priority desc, date, id')

        products_to_outs = defaultdict(lambda: [])
        for out in outs:
            products_to_outs[out.product_id].append(out)

        sources_to_lines = defaultdict(lambda: [])  # group by source so we can print them together
        sources_to_reservable_move_ids = defaultdict(lambda: [])  # track moves by source + 'all_sources' for "Reserve All" buttons
        moves_to_qtys = defaultdict(float)  # track the incoming qty each move can reserve (i.e. avoid reserving more than incoming qty)
        for product_id, outs in products_to_outs.items():
            for out in outs:
                source = out._get_source_document()
                if not source:
                    continue
                already_reserved = 0.0
                uom = out.product_uom
                qty_expected = product_to_qty_expected.get(product_id, 0)
                qty_done = product_to_qty_done.get(product_id, 0)
                if out.state == 'partially_available':
                    already_reserved = out.product_uom._compute_quantity(out.reserved_availability, uom)
                demand = out.product_qty - already_reserved
                to_reserve = min(qty_done, demand)
                if float_is_zero(to_reserve, precision_rounding=uom.rounding):
                    to_expect = min(qty_expected, demand)
                    if float_is_zero(to_expect, precision_rounding=uom.rounding):
                        # no more qtys done or to do that can be reserved for this product
                        break
                    else:
                        sources_to_lines[source].append(self._prepare_report_line(to_expect, product_id, out, is_qty_available=False))
                        product_to_qty_expected[product_id] -= to_expect
                else:
                    sources_to_lines[source].append(self._prepare_report_line(to_reserve, product_id, out, is_qty_available=True))
                    sources_to_reservable_move_ids[source].append(out.id)
                    sources_to_reservable_move_ids['all_sources'].append(out.id)
                    moves_to_qtys[out.id] = to_reserve
                    product_to_qty_done[product_id] -= to_reserve
                    # check if we should split line between reservable and non-reservable qtys
                    if float_compare(demand, to_reserve, precision_rounding=uom.rounding) == 1:
                        to_expect = min(qty_expected, demand - to_reserve)
                        if float_is_zero(to_expect, precision_rounding=uom.rounding):
                            break
                        else:
                            sources_to_lines[source].append(self._prepare_report_line(to_expect, product_id, out, is_qty_available=False))
                            product_to_qty_expected[product_id] -= to_expect

                # ignore rest of this product's moves if no more incoming qtys to allocate
                if float_is_zero(product_to_qty_expected.get(product_id, 0), precision_rounding=uom.rounding) \
                        and float_is_zero(product_to_qty_done.get(product_id, 0), precision_rounding=uom.rounding):
                    break

        # dates aren't auto-formatted when printed in report :(
        sources_to_formatted_scheduled_date = defaultdict(lambda: [])
        for source, dummy in sources_to_lines.items():
            sources_to_formatted_scheduled_date[source] = self._get_formatted_scheduled_date(source)

        return {
            'data': data,
            'doc_ids': docids,
            'doc_model': 'stock.picking',
            'sources_to_lines': sources_to_lines,
            'sources_to_reservable_move_ids': sources_to_reservable_move_ids,
            'precision': self.env['decimal.precision'].precision_get('Product Unit of Measure'),
            'receipts': receipts,
            'sources_to_formatted_scheduled_date': sources_to_formatted_scheduled_date,
            'moves_to_qtys': moves_to_qtys
        }

    def _prepare_report_line(self, quantity, product, move_out, is_qty_available=False):
        return {
            'document_out': move_out._get_source_document() if move_out else False,
            'product': {
                'id': product.id,
                'display_name': product.display_name
            },
            'uom': product.uom_id.display_name,
            'quantity': quantity,
            'move_out': move_out,
            'is_qty_available': is_qty_available,
            # 'priority': move_out.priority,
        }

    def _get_formatted_scheduled_date(self, source):
        """ Unfortunately different source record types have different field names for their "Scheduled Date"
        Therefore an extendable method is needed.
        """
        if source._name == 'stock.picking':
            return format_date(self.env, source.scheduled_date)
        return False

    def action_assign(self, move_ids, qtys, source_picking_ids):
        """ Handles all "Reserve" buttons so that we ensure a snapshot is saved of the reserved moves and their qtys
        since we have no way of tracking this otherwise.
        """
        moves = self.env['stock.move'].browse(move_ids)
        move_id_to_qty = dict(zip(moves, qtys))
        moves.mapped('product_id')

        labels = self.env.ref('product.report_product_label')._render_qweb_pdf(res_ids=moves.product_id.ids)
        report = self.env.ref('stock.stock_reception_report_action')._render_qweb_pdf(res_ids=source_picking_ids, data={'move_ids': move_ids})
        pickings = self.env['stock.picking'].browse(source_picking_ids)
        for picking in pickings:
            picking.message_post(
                attachments=[('%s.pdf' % _("Allocation Report"), report[0]), ('%s.pdf' % _("Product Labels"), labels[0])],
                body=_('Incoming products have been allocated')
            )

        moves.with_context(qty_to_reserve=move_id_to_qty)._action_assign()
