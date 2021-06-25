# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from collections import defaultdict

from odoo import _, api, fields, models
from odoo.exceptions import UserError
from odoo.tools import float_compare, float_is_zero, float_round, format_date


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
        product_to_ins_to_reserve = defaultdict(lambda: [])
        for move in receipts.move_lines:
            if move.product_id.type != 'product':
                continue
            if move.state == 'done':
                quantity_done = move.product_uom._compute_quantity(move.quantity_done, move.product_id.uom_id, rounding_method='HALF-UP')
                if float_compare(move.report_reserved_quantity, quantity_done, precision_rounding=move.product_uom.rounding) == -1:
                    product_to_qty_done[move.product_id] += quantity_done - move.report_reserved_quantity
                    product_to_ins_to_reserve[move.product_id].append(move.id)
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

        outs = []
        if product_ids:
            outs = self.env['stock.move'].search(
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
            if out.location_dest_id.usage != 'internal' or self._get_qty_linked_to_outgoing(out):
                products_to_outs[out.product_id].append(out)

        sources_to_lines = defaultdict(lambda: [])  # group by source so we can print them together
        sources_to_reservable_move_out_ids = defaultdict(lambda: [])  # track moves by source + 'all_sources' for "Reserve All" buttons
        sources_to_reservable_move_in_ids = defaultdict(set)  # track moves by source + 'all_sources' for "Reserve All" buttons
        for product_id, outs in products_to_outs.items():
            for out in outs:
                source = self._get_last_steps(out)[0]._get_source_document()
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
                    sources_to_lines[source].append(self._prepare_report_line(to_reserve, product_id, out, is_qty_available=True, move_ins=product_to_ins_to_reserve[product_id]))
                    sources_to_reservable_move_out_ids[source].append(out.id)
                    sources_to_reservable_move_out_ids['all_sources'].append(out.id)
                    sources_to_reservable_move_in_ids[source].update(product_to_ins_to_reserve[product_id])
                    sources_to_reservable_move_in_ids['all_sources'].update(product_to_ins_to_reserve[product_id])
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

        # TODO: add already reserved lines... + handling of changed Done qty after already reserved
        # for move, qty in already_linked_moves_to_qty.items():
        #     source = move._get_source_document()
        #     sources_to_lines[source].append(self._prepare_report_line(qty, move.product_id, move, is_qty_available=True, is_reserved=True))
        # dates aren't auto-formatted when printed in report :(
        sources_to_formatted_scheduled_date = defaultdict(lambda: [])
        for source, dummy in sources_to_lines.items():
            sources_to_formatted_scheduled_date[source] = self._get_formatted_scheduled_date(source)

        return {
            'data': data,
            'doc_ids': docids,
            'doc_model': 'stock.picking',
            'sources_to_lines': sources_to_lines,
            'sources_to_reservable_move_out_ids': sources_to_reservable_move_out_ids,
            'precision': self.env['decimal.precision'].precision_get('Product Unit of Measure'),
            'receipts': receipts,
            'sources_to_formatted_scheduled_date': sources_to_formatted_scheduled_date,
        }

    def _prepare_report_line(self, quantity, product, move_out, is_qty_available=False, is_reserved=False, move_ins=False):
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
            'is_reserved': is_reserved,
            'move_ins': move_ins
        }

    def _get_formatted_scheduled_date(self, source):
        """ Unfortunately different source record types have different field names for their "Scheduled Date"
        Therefore an extendable method is needed.
        """
        if source._name == 'stock.picking':
            return format_date(self.env, source.scheduled_date)
        return False

    def _get_qty_linked_to_outgoing(self, move):
        """ Follow move_dest_ids until an outgoing move is found. If found => yes + qty linked. We assume that
        if linked, the outgoing/link connection (i.e. the final incoming move step) have been adjusted to match
        their incoming/outgoing amounts to avoid reservation issues (i.e. by splitting moves).
        """
        total_amount_linked = 0
        if move.move_dest_ids:
            for chained_move in move.move_dest_ids:
                total_amount_linked += self._get_qty_linked_to_outgoing(chained_move)
        elif move.location_dest_id.usage != 'internal':
            total_amount_linked += move.product_qty
        return total_amount_linked

    def action_assign(self, move_ids, qtys, in_ids):
        """ Links incoming move's last step(s) (or itself if 1-step) to outgoing move's
        first step (or itself if 1-step)
        """
        outs = self.env['stock.move'].browse(move_ids)
        outs_to_expected_qty = dict(zip(outs, qtys))
        ins = self.env['stock.move'].browse(in_ids)

        products_to_ins = defaultdict(lambda: [])
        for move in ins:
            products_to_ins[move.product_id].append(move)

        def _link_move(out, qty_to_link):
            potential_ins = products_to_ins[out.product_id]

            if float_compare(out.product_qty, qty_to_link, precision_rounding=out.product_id.uom_id.rounding) == 1:
                # we are only reserving part of its demand => let's split it now to prevent reservation problems later
                new_move_vals = out._split(out.product_qty - qty_to_link)
                new_out = self.env['stock.move'].create(new_move_vals)
                new_out._action_confirm(merge=False)

            for in_move in reversed(potential_ins):
                quantity_done = in_move.product_uom._compute_quantity(in_move.quantity_done, in_move.product_id.uom_id, rounding_method='HALF-UP')
                quantity_remaining = quantity_done - in_move.report_reserved_quantity
                if float_compare(0, quantity_remaining, precision_rounding=in_move.product_id.uom_id.rounding) >= 0:
                    # in move is already completely linked (e.g. during another reverse click) => don't count it again
                    potential_ins.pop()
                    continue

                # get incoming move(s) to link to outgoing move
                in_moves_to_link = self._get_last_steps(in_move)
                is_single_step = False
                if not in_moves_to_link or in_moves_to_link == in_move:
                    # we're dealing with single step incoming
                    in_moves_to_link = in_move
                    is_single_step = True

                need_comparison = float_compare(qty_to_link, quantity_remaining, precision_rounding=in_move.product_id.uom_id.rounding)
                if need_comparison >= 0:
                    potential_ins.pop()  # we're using up this incoming move
                for in_move_to_link in in_moves_to_link:
                    if not is_single_step:
                        if float_compare(in_move_to_link.product_qty, quantity_remaining, precision_rounding=in_move.product_id.uom_id.rounding) == 1:
                            # we have a merged internal move case from multiple receipts => we need to make sure we don't over-reserve by accident
                            qty_to_split = min(quantity_remaining, qty_to_link)
                            self._split(in_move_to_link, in_move_to_link.product_uom_qty - in_move_to_link.product_id.uom_id._compute_quantity(qty_to_split, in_move_to_link.product_uom, rounding_method='HALF-UP'))
                        need_comparison = float_compare(qty_to_link, in_move_to_link.product_qty, precision_rounding=in_move.product_id.uom_id.rounding)
                        if need_comparison == -1:
                            # we have more qty in incoming move than is needed for the outgoing move => split incoming move (not needed when single step)
                            self._split(in_move_to_link, in_move_to_link.product_uom_qty - in_move_to_link.product_id.uom_id._compute_quantity(qty_to_link, in_move_to_link.product_uom, rounding_method='HALF-UP'))
                    linked_qty = min(in_move_to_link.product_qty, qty_to_link)
                    in_move.report_reserved_quantity += linked_qty
                    in_move_to_link.move_dest_ids |= out
                    out.procure_method = 'make_to_order'
                    quantity_remaining -= in_move_to_link.product_qty
                    in_move_to_link.is_reception_report_linked = True
                    qty_to_link -= linked_qty
                    if float_is_zero(qty_to_link, precision_rounding=out.product_id.uom_id.rounding) or float_is_zero(quantity_remaining, precision_rounding=in_move.product_id.uom_id.rounding):
                        break  # we have satistfied the qty_to_link or we have used up this in_move
                if float_is_zero(qty_to_link, precision_rounding=out.product_id.uom_id.rounding):
                    break

        for out, qty in outs_to_expected_qty.items():
            _link_move(out, qty)

        outs.filtered(lambda move: move.picking_type_id.reservation_method == 'at_confirm'
                                   or (move.picking_type_id.reservation_method != 'manual'
                                       and move.reservation_date <= fields.Date.today()))\
            ._action_assign()

    def _get_last_steps(self, move):
        """ Returns the last step in the move chain that has not been linked by the reception report
        (i.e. to an outgoing move chain). Returns no moves if 1-step and already linked.
        """
        moves = self.env['stock.move']
        if move.is_reception_report_linked:
            return moves
        if not move.move_dest_ids:
            moves |= move
        else:
            for dest in move.move_dest_ids:
                moves |= self._get_last_steps(dest)
        return moves

    def _split(self, move, qty):
        """ Splitting is an unforunate hack we need to do to correctly manage moves linkages. We cannot
        reuse the stock.move version due to the special nature of the report's splitting (e.g. splitting of 'done' moves).
        This should only be used to split a chained (MTO) move here!!

        :param qty: float. quantity to split (given in product UoM)
        """
        if move.state == 'cancel':
            raise UserError(_('There is an issue reserving this move due a cancellation somewhere in the transfer chain.'))
        if float_is_zero(qty, precision_rounding=move.product_id.uom_id.rounding) or move.product_qty <= qty:
            return []
        # force_split_uom_id = handle uom rounding issue, e.g. splitting move with uom rounding = 1
        decimal_precision = self.env['decimal.precision'].precision_get('Product Unit of Measure')
        uom_qty = move.product_id.uom_id._compute_quantity(qty, move.product_uom, rounding_method='HALF-UP')
        if float_compare(qty, move.product_uom._compute_quantity(uom_qty, move.product_id.uom_id, rounding_method='HALF-UP'), precision_digits=decimal_precision) == 0:
            defaults = move._prepare_move_split_vals(uom_qty)
        else:
            defaults = move.with_context(force_split_uom_id=self.product_id.uom_id.id)._prepare_move_split_vals(qty)

        defaults['procure_method'] = 'make_to_order'
        new_move_vals = move.copy_data(defaults)

        # Update the original `product_qty` of the move. Use the general product's decimal
        # precision and not the move's UOM to handle case where the `quantity_done` is not
        # compatible with the move's UOM.
        new_product_qty = move.product_id.uom_id._compute_quantity(move.product_qty - qty, move.product_uom, round=False)
        new_product_qty = float_round(new_product_qty, precision_digits=decimal_precision)
        move.write({'product_uom_qty': new_product_qty})

        new_move = self.env['stock.move'].create(new_move_vals)
        if move.state == 'Done':
            new_move.state = 'Done'
        else:
            new_move._action_confirm(merge=False)
        (move | new_move)._action_assign()
        return new_move
