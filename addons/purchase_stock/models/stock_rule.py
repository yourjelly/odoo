# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from dateutil.relativedelta import relativedelta
from itertools import groupby

from odoo import api, fields, models, _
from odoo.exceptions import UserError


class StockRule(models.Model):
    _inherit = 'stock.rule'

    action = fields.Selection(selection_add=[('buy', 'Buy')])

    def _get_message_dict(self):
        message_dict = super(StockRule, self)._get_message_dict()
        dummy, destination, dummy = self._get_message_values()
        message_dict.update({
            'buy': _('When products are needed in <b>%s</b>, <br/> a request for quotation is created to fulfill the need.') % (destination)
        })
        return message_dict

    @api.onchange('action')
    def _onchange_action(self):
        domain = {'picking_type_id': []}
        if self.action == 'buy':
            self.location_src_id = False
            domain = {'picking_type_id': [('code', '=', 'incoming')]}
        return {'domain': domain}

    @api.model
    def _run_buy(self, procurements_list):
        procurements_with_same_domain = {}
        for procurement, rule in procurements_list:

            # Get the schedule date in order to find a valid seller
            procurement_date_planned = fields.Datetime.from_string(procurement.values['date_planned'])
            schedule_date = (procurement_date_planned - relativedelta(days=procurement.values['company_id'].po_lead))

            supplier = procurement.product_id._select_seller(
                quantity=procurement.product_qty,
                date=schedule_date.date(),
                uom_id=procurement.product_uom)

            if not supplier:
                msg = _('There is no vendor associated to the product %s. Please define a vendor for this product.') % (procurement.product_id.display_name,)
                raise UserError(msg)

            partner = supplier.name
            # we put `supplier_info` in values for extensibility purposes
            procurement.values['supplier'] = supplier

            domain = rule._make_po_get_domain(procurement.values, partner)
            if domain in procurements_with_same_domain:
                procurements_with_same_domain[domain].append(procurement)
            else:
                procurements_with_same_domain[domain] = [procurement]

        for domain, procurements_list in procurements_with_same_domain.items():
            origins = set([p.origin for p in procurements_list])
            po = self.env['purchase.order'].sudo().search([dom for dom in domain], limit=1)
            if not po:
                procurements_values = [p.values for p in procurements_list]
                vals = rule._prepare_purchase_order(origins, procurements_values)
                company_id = procurements_values[0].get('company_id') and procurements_values[0]['company_id'].id or self.env.user.company_id.id
                po = self.env['purchase.order'].with_context(force_company=company_id).sudo().create(vals)
            elif not po.origin or any(origin not in po.origin.split(', ') for origin in origins):
                if po.origin:
                    if origins:
                        missing_origins = origins - set(po.origin.split(', '))
                        if missing_origins:
                            po.write({'origin': po.origin + ', ' + ', '.join(missing_origins)})
                else:
                    po.write({'origin': ', '.join(origins)})

            similar_procurements = self._get_similar_procurements(procurements_list)
            procurements = self._merge_similar_procurements(similar_procurements)
            procurements = {p.product_id: p for p in procurements}

            # Create Line
            for line in po.order_line:
                if line.product_id in list(procurements.keys()) and line.product_uom == line.product_id.uom_po_id:
                    procurement = procurements.pop(line.product_id)
                    if line._merge_in_existing_line(procurement.product_id,
                            procurement.product_qty, procurement.product_uom,
                            procurement.location_id, procurement.name,
                            procurement.origin, procurement.values):
                        vals = self._update_purchase_order_line(procurement.product_id,
                            procurement.product_qty, procurement.product_uom,
                            procurement.values, line)
                        line.write(vals)

            po_line_values_list = []
            for procurement in procurements.values():
                partner = procurement.values['supplier'].name
                po_line_values_list.append(self._prepare_purchase_order_line(
                    procurement.product_id, procurement.product_qty,
                    procurement.product_uom, procurement.values, po))
            self.env['purchase.order.line'].create(po_line_values_list)

    @api.model
    def _get_similar_procurements_groupby(self, procurement):
        return procurement.product_id.id

    @api.model
    def _get_similar_procurements_sorted(self, procurement):
        return procurement.product_id

    @api.model
    def _get_similar_procurements(self, procurements_list):
        """ Get a list of procurements values and create groups of procuments
        that would use the same purchase order line.
        params procurements_list list: procurements requests (not ordered nor
        sorted).
        return list: procurements requests grouped by their product_id.
        """
        similar_procurements = []

        for k, procurements in groupby(sorted(procurements_list, key=self._get_similar_procurements_sorted), key=self._get_similar_procurements_groupby):
            similar_procurements.append(list(procurements))
        return similar_procurements

    @api.model
    def _merge_similar_procurements(self, similar_procurements):
        """ Merge the quantity for procurements requests that could use the same
        order line.
        params similar_procurements list: list of procurements that have been
        marked as 'alike' from _get_similar_procurements method.
        return a list of procurements values where values of similar_procurements
        list have been merged.
        """
        combined_procurement_list = []
        for procurements_list in similar_procurements:
            quantity = 0
            move_dest_ids = self.env['stock.move']
            order_point_id = self.env['stock.warehouse.orderpoint']
            for procurement in procurements_list:
                if procurement.values.get('move_dest_ids'):
                    move_dest_ids |= procurement.values['move_dest_ids']
                if not order_point_id and procurement.values.get('order_point_id'):
                    order_point_id = procurement.values['order_point_id']
                quantity += procurement.product_qty
            procurement.values['move_dest_ids'] = move_dest_ids
            procurement.values['order_point_id'] = move_dest_ids
            combined_procurement_list.append(procurement._replace(product_qty=quantity))
        return combined_procurement_list

    def _update_purchase_order_line(self, product_id, product_qty, product_uom, values, line):
        partner = values['supplier'].name
        procurement_uom_po_qty = product_uom._compute_quantity(product_qty, product_id.uom_po_id)
        seller = product_id._select_seller(
            partner_id=partner,
            quantity=line.product_qty + procurement_uom_po_qty,
            date=line.order_id.date_order and line.order_id.date_order.date(),
            uom_id=product_id.uom_po_id)

        price_unit = self.env['account.tax']._fix_tax_included_price_company(seller.price, line.product_id.supplier_taxes_id, line.taxes_id, values['company_id']) if seller else 0.0
        if price_unit and seller and line.order_id.currency_id and seller.currency_id != line.order_id.currency_id:
            price_unit = seller.currency_id._convert(
                price_unit, line.order_id.currency_id, line.order_id.company_id, fields.Date.today())

        return {
            'product_qty': line.product_qty + procurement_uom_po_qty,
            'price_unit': price_unit,
            'move_dest_ids': [(4, x.id) for x in values.get('move_dest_ids', [])]
        }

    @api.multi
    def _prepare_purchase_order_line(self, product_id, product_qty, product_uom, values, po):
        partner = values['supplier'].name
        procurement_uom_po_qty = product_uom._compute_quantity(product_qty, product_id.uom_po_id)
        # _select_seller is used if the supplier have different price depending
        # the quantities ordered.
        seller = product_id._select_seller(
            partner_id=partner,
            quantity=procurement_uom_po_qty,
            date=po.date_order and po.date_order.date(),
            uom_id=product_id.uom_po_id)

        taxes = product_id.supplier_taxes_id
        fpos = po.fiscal_position_id
        taxes_id = fpos.map_tax(taxes, product_id, seller.name) if fpos else taxes
        if taxes_id:
            taxes_id = taxes_id.filtered(lambda x: x.company_id.id == values['company_id'].id)

        price_unit = self.env['account.tax']._fix_tax_included_price_company(seller.price, product_id.supplier_taxes_id, taxes_id, values['company_id']) if seller else 0.0
        if price_unit and seller and po.currency_id and seller.currency_id != po.currency_id:
            price_unit = seller.currency_id._convert(
                price_unit, po.currency_id, po.company_id, po.date_order or fields.Date.today())

        product_lang = product_id.with_context({
            'lang': partner.lang,
            'partner_id': partner.id,
        })
        name = product_lang.display_name
        if product_lang.description_purchase:
            name += '\n' + product_lang.description_purchase

        date_planned = self.env['purchase.order.line']._get_date_planned(seller, po=po)

        return {
            'name': name,
            'product_qty': procurement_uom_po_qty,
            'product_id': product_id.id,
            'product_uom': product_id.uom_po_id.id,
            'price_unit': price_unit,
            'date_planned': date_planned,
            'orderpoint_id': values.get('orderpoint_id', False) and values.get('orderpoint_id').id,
            'taxes_id': [(6, 0, taxes_id.ids)],
            'order_id': po.id,
            'move_dest_ids': [(4, x.id) for x in values.get('move_dest_ids', [])],
        }

    def _prepare_purchase_order(self, origins, values):
        dates = [fields.Datetime.from_string(value['date_planned']) for value in values]

        procurement_date_planned = min(dates)
        schedule_date = (procurement_date_planned - relativedelta(days=values[0]['company_id'].po_lead))

        values = values[0]
        partner = values['supplier'].name
        purchase_date = schedule_date - relativedelta(days=int(values['supplier'].delay))

        fpos = self.env['account.fiscal.position'].with_context(force_company=values['company_id'].id).get_fiscal_position(partner.id)

        gpo = self.group_propagation_option
        group = (gpo == 'fixed' and self.group_id.id) or \
                (gpo == 'propagate' and values.get('group_id') and values['group_id'].id) or False

        return {
            'partner_id': partner.id,
            'picking_type_id': self.picking_type_id.id,
            'company_id': values['company_id'].id,
            'currency_id': partner.with_context(force_company=values['company_id'].id).property_purchase_currency_id.id or self.env.user.company_id.currency_id.id,
            'dest_address_id': values.get('partner_id', False),
            'origin': ', '.join(origins),
            'payment_term_id': partner.with_context(force_company=values['company_id'].id).property_supplier_payment_term_id.id,
            'date_order': purchase_date,
            'fiscal_position_id': fpos,
            'group_id': group
        }

    def _make_po_get_domain(self, values, partner):
        domain = super(StockRule, self)._make_po_get_domain(values, partner)
        gpo = self.group_propagation_option
        group = (gpo == 'fixed' and self.group_id) or \
                (gpo == 'propagate' and 'group_id' in values and values['group_id']) or False

        domain += (
            ('partner_id', '=', partner.id),
            ('state', '=', 'draft'),
            ('picking_type_id', '=', self.picking_type_id.id),
            ('company_id', '=', values['company_id'].id),
        )
        if group:
            domain += (('group_id', '=', group.id),)
        return domain

    def _push_prepare_move_copy_values(self, move_to_copy, new_date):
        res = super(StockRule, self)._push_prepare_move_copy_values(move_to_copy, new_date)
        res['purchase_line_id'] = None
        return res
