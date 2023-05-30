# -*- coding: utf-8 -*-

import uuid

from odoo import http, fields
from odoo.http import request
from werkzeug.exceptions import NotFound, BadRequest, Unauthorized


from odoo.addons.pos_self_order.controllers.utils import (
    get_pos_config_sudo,
    get_table_sudo,
)

class PosSelfOrderController(http.Controller):
    @http.route(
        "/pos-self-order/process-new-order",
        auth="public",
        type="json",
        website=True,
    )
    def process_new_order(
        self,
        order,
    ):
        pos_config_id = order.get('pos_config_id')
        access_token = order.get('access_token')
        lines = order.get('lines')

        pos_config_sudo = get_pos_config_sudo(pos_config_id)
        pos_session_sudo = pos_config_sudo.current_session_id
        table_sudo = get_table_sudo(access_token)

        if not pos_config_sudo.self_order_table_mode or not pos_config_sudo.has_active_session:
            raise BadRequest
        if not table_sudo or not pos_session_sudo:
            raise Unauthorized

        sequence_number = self._get_sequence_number(table_sudo.id, pos_session_sudo.id)
        unique_id = self._generate_unique_id(pos_session_sudo.id, table_sudo.id, sequence_number)

        # Create the order without lines and prices computed
        # We need to remap the order because some required fields are not used in the frontend.
        order = {
            'id': unique_id,
            'data': {
                'uuid': order.get('uuid'),
                'name': unique_id,
                'user_id': request.session.uid,
                'sequence_number': sequence_number,
                'access_token': uuid.uuid4().hex,
                'pos_session_id': pos_session_sudo.id,
                'table_id': table_sudo.id,
                "partner_id": False,
                "creation_date": str(fields.Datetime.now()),
                "fiscal_position_id": False,
                "statement_ids": [],
                "lines": [],
                'amount_tax': 0,
                'amount_total': 0,
                'amount_paid': 0,
                'amount_return': 0,
            },
            "to_invoice": False,
            'session_id': pos_session_sudo.id,
        }

        # Save the order in the database to get the id
        posted_order_id = request.env['pos.order'].sudo().create_from_ui([order], draft=True)[0].get('id')

        # Process the lines and get their prices computed
        lines = self._process_lines(lines, pos_config_sudo, posted_order_id)

        # Compute the order prices
        amount_untaxed, amount_tax = self._get_computed_order_price(lines, pos_config_sudo)

        # Update the order with the computed prices and lines
        order_sudo = request.env["pos.order"].sudo().browse(posted_order_id)
        order_sudo.lines.create(lines)
        order_sudo.write({
            'amount_tax': amount_tax,
            'amount_total': amount_untaxed + amount_tax,
        })

        return order_sudo._export_for_self_order()

    def _process_lines(self, lines, pos_config_sudo, pos_order_id):
        newLines = []

        for line in lines:
            product_sudo = request.env["product.product"].sudo().browse(int(line.get("product_id")))
            compute_line_prices = self._get_computed_line_prices(product_sudo, line, pos_config_sudo)
            line_description = line.get("description")
            product_name = product_sudo._get_name()

            newLines.append({
                **compute_line_prices,
                'id': line.get('id'),
                'order_id': pos_order_id,
                'tax_ids': product_sudo.taxes_id,
                'uuid': line.get('uuid'),
                'product_id': line.get('product_id'),
                'qty': line.get('qty'),
                'customer_note': line.get('customer_note'),
                'full_product_name': f"{product_name} ({line_description})" if line_description else product_name,
            })

        return newLines

    def _get_computed_line_prices(self, product_sudo, line, pos_config_sudo):
        tax_results = self._get_line_taxes([line], pos_config_sudo)
        totals = list(tax_results['totals'].values())[0]
        amount_untaxed = totals['amount_untaxed']
        amount_tax = totals['amount_tax']

        return {
            'price_unit': product_sudo.lst_price,
            'price_subtotal': amount_untaxed,
            'price_subtotal_incl': amount_tax + amount_untaxed,
            'price_extra': 0,
        }

    def _get_line_taxes(self, lines, pos_config_sudo):
        base_lines_dict = []

        for line in lines:
            product_sudo = request.env["product.product"].sudo().browse(int(line.get("product_id")))
            base_lines_dict.append(request.env['account.tax'].sudo()._convert_to_tax_base_line_dict(
                self,
                currency=pos_config_sudo.currency_id,
                product=product_sudo,
                taxes=product_sudo.taxes_id,
                price_unit=product_sudo.lst_price,
                quantity=line.get('qty'),
                price_subtotal=product_sudo.lst_price * line.get('qty'),
            ))

        return request.env['account.tax'].sudo()._compute_taxes(base_lines_dict)

    def _get_computed_order_price(self, lines, pos_config_sudo):
        if request.env.company.tax_calculation_rounding_method == 'round_globally':
            lines_tax_results = self._get_line_taxes(lines, pos_config_sudo)
            totals = lines_tax_results['totals']
            amount_untaxed = totals.get(pos_config_sudo.currency_id, {}).get('amount_untaxed', 0.0)
            amount_tax = totals.get(pos_config_sudo.currency_id, {}).get('amount_tax', 0.0)
        else:
            amount_untaxed = sum([line.get('price_subtotal') for line in lines])
            amount_tax = sum([line.get('price_subtotal_incl') - line.get('price_subtotal') for line in lines])

        amount_total = amount_untaxed + amount_tax
        return amount_total, amount_tax

    @http.route(
        '/pos-self-order/update-existing-order',
        auth="public",
        type="json",
        website=True,
    )
    def update_existing_order(self, order):
        order_pos_reference = order.get('pos_reference')
        order_access_token = order.get('access_token')
        pos_config_id = order.get('pos_config_id')
        pos_config_sudo = get_pos_config_sudo(pos_config_id)

        order_sudo = request.env['pos.order'].sudo().search([
            ('pos_reference', '=', order_pos_reference),
            ('access_token', '=', order_access_token),
        ])

        if not order_sudo:
            raise Unauthorized
        elif order_sudo.state != 'draft':
            raise BadRequest("Order is not in draft state")

        lines = self._process_lines(order.get('lines'), pos_config_sudo, order_sudo.id)
        for line in lines:
            if line.get('id'):
                line_sudo = order_sudo.lines.filtered(lambda l: l.id == line.get('id'))
                line_sudo.write({
                   **line,
                })
            else:
                order_sudo.lines.create(line)

        amount_total, amount_tax = self._get_computed_order_price(lines, pos_config_sudo)
        order_sudo.write({
            'amount_tax': amount_tax,
            'amount_total': amount_total,
        })

        return order_sudo._export_for_self_order()

    @http.route(
        '/pos-self-order/get-orders',
        auth='public',
        type='json',
        website=True,
    )
    def get_orders_by_access_token(self, pos_references, access_tokens):
        orders_sudo = request.env["pos.order"].sudo().search([
            ("access_token", "in", access_tokens),
        ])

        if not orders_sudo:
            raise NotFound()

        orders = []
        for order in orders_sudo:
            orders.append(order._export_for_self_order())

        return orders

    @http.route(
        '/pos-self-order/get-orders-taxes',
        auth='public',
        type='json',
        website=True,
    )
    def get_order_taxes(self, order, pos_config_id):
        pos_config_sudo = get_pos_config_sudo(pos_config_id)

        lines = self._process_lines(order.get('lines'), pos_config_sudo, 0)
        amount_total, amount_tax = self._get_computed_order_price(lines, pos_config_sudo)

        return {
            'lines': [{
                'uuid': line.get('uuid'),
                'price_subtotal': line.get('price_subtotal'),
                'price_subtotal_incl': line.get('price_subtotal_incl'),
            } for line in lines],
            'amount_total': amount_total,
            'amount_tax': amount_tax,
        }


    # The first part will be the session_id of the order.
    # The second part will be the table_id of the order.
    # Last part the sequence number of the order.
    # INFO: This is allow a maximum of 999 tables and 9999 orders per table, so about ~1M orders per session.
    # Example: 'Self-Order 00001-001-0001'
    def _generate_unique_id(self, pos_session_id: int, table_id: int, sequence_number: int) -> str:
        first_part = "{:05d}".format(int(pos_session_id))
        second_part = "{:03d}".format(int(table_id))
        third_part = "{:04d}".format(int(sequence_number))

        return f"Self-Order {first_part}-{second_part}-{third_part}"

    def _get_sequence_number(self, table_id: int, session_id: int) -> int:
        order_sudo = request.env["pos.order"].sudo().search([(
            'pos_reference',
            'like',
            f"Self-Order {session_id:0>5}-{table_id:0>3}")], order='id desc', limit=1)

        return (order_sudo.sequence_number + 1) or 1
