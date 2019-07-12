# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api


class pos_config(models.Model):
    _inherit = 'pos.config'

    report_sequence_number = fields.Integer()

    def get_next_report_sequence_number(self):
        to_return = self.report_sequence_number
        self.report_sequence_number += 1

        return to_return


class pos_session(models.Model):
    _inherit = 'pos.session'

    def get_user_report_data(self):
        data = {}

        for order in self.order_ids:
            if not data.get(order.user_id.id):
                data[order.user_id.id] = {
                    'login': order.user_id.login,
                    'revenue': order.amount_total,
                    'first_ticket_time': order.blackbox_pos_receipt_time,
                    'last_ticket_time': order.blackbox_pos_receipt_time
                }
            else:
                current = data[order.user_id.id]
                current['revenue'] += order.amount_total

        total_sold_per_category_per_user = self.get_total_sold_per_category(group_by_user_id=True)

        for user in total_sold_per_category_per_user:
            data[user[0]]['revenue_per_category'] = list(user[1].items())

        return data

    def get_total_sold_per_category(self, group_by_user_id=None):
        total_sold_per_user_per_category = {}

        for order in self.order_ids:
            if group_by_user_id:
                user_id = order.user_id.id
            else:
                # use a user_id of 0 to keep the logic between with user group and without user group the same
                user_id = 0

            if user_id not in total_sold_per_user_per_category:
                total_sold_per_user_per_category[user_id] = {}

            total_sold_per_category = total_sold_per_user_per_category[user_id]

            for line in order.lines:
                key = line.product_id.pos_categ_id.name or "None"

                if key in total_sold_per_category:
                    total_sold_per_category[key] += line.price_subtotal_incl
                else:
                    total_sold_per_category[key] = line.price_subtotal_incl

        if group_by_user_id or not total_sold_per_user_per_category:
            return list(total_sold_per_user_per_category.items())
        else:
            return list(total_sold_per_user_per_category[0].items())

    @api.depends('statement_ids')
    def _compute_total_sold(self):
        self.ensure_one()
        self.total_sold = 0

        for st in self.statement_ids:
            self.total_sold += st.total_entry_encoding

    @api.depends('order_ids')
    def _compute_discounts(self):
        self.ensure_one()
        self.amount_of_discounts = 0
        self.total_discount = 0
        for order in self.order_ids:
            for line in order.lines:
                if line.discount > 0:
                    self.amount_of_discounts += 1

                    original_line_discount = line.discount
                    line.discount = 0
                    price_without_discount = line.price_subtotal_incl
                    line.discount = original_line_discount

                    self.total_discount += price_without_discount - line.price_subtotal_incl

    @api.depends('order_ids')
    def _compute_corrections(self):
        self.ensure_one()
        self.amount_of_corrections = 0
        self.total_corrections = 0

        for order in self.order_ids:
            for line in order.lines:
                if line.price_subtotal_incl < 0:
                    self.amount_of_corrections += 1
                    self.total_corrections += line.price_subtotal_incl
