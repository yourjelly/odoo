# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from contextlib import contextmanager
import re
from unittest.mock import PropertyMock, patch

from lxml.builder import E

from odoo import api, fields, models, _
from odoo.exceptions import ValidationError
from odoo.tools import table_columns


class AccountAnalyticLine(models.Model):
    _name = 'account.analytic.line'
    _description = 'Analytic Line'
    _order = 'date desc, id desc'
    _check_company_auto = True

    name = fields.Char(
        'Description',
        required=True,
    )
    date = fields.Date(
        'Date',
        required=True,
        index=True,
        default=fields.Date.context_today,
    )
    amount = fields.Monetary(
        'Amount',
        required=True,
        default=0.0,
    )
    unit_amount = fields.Float(
        'Quantity',
        default=0.0,
    )
    product_uom_id = fields.Many2one(
        'uom.uom',
        string='Unit of Measure',
        domain="[('category_id', '=', product_uom_category_id)]",
    )
    product_uom_category_id = fields.Many2one(
        related='product_uom_id.category_id',
        string='UoM Category',
        readonly=True,
    )
    account_id = fields.Many2one(
        'account.analytic.account',
        'Analytic Account',
        required=True,
        ondelete='restrict',
        index=True,
        check_company=True,
    )
    partner_id = fields.Many2one(
        'res.partner',
        string='Partner',
        check_company=True,
    )
    user_id = fields.Many2one(
        'res.users',
        string='User',
        default=lambda self: self.env.context.get('user_id', self.env.user.id),
        index=True,
    )
    company_id = fields.Many2one(
        'res.company',
        string='Company',
        required=True,
        readonly=True,
        default=lambda self: self.env.company,
    )
    currency_id = fields.Many2one(
        related="company_id.currency_id",
        string="Currency",
        readonly=True,
        store=True,
        compute_sudo=True,
    )
    plan_id = fields.Many2one(
        'account.analytic.plan',
        related='account_id.plan_id',
        store=True,
        readonly=True,
        compute_sudo=True,
    )
    category = fields.Selection(
        [('other', 'Other')],
        default='other',
    )

    @api.constrains('company_id', 'account_id')
    def _check_company_id(self):
        for line in self:
            if line.account_id.company_id and line.company_id.id != line.account_id.company_id.id:
                raise ValidationError(_('The selected account belongs to another company than the one you\'re trying to create an analytic item for'))

    @contextmanager
    def _exclude_fake_fields(self):
        filtered_fields = {k: v for k, v in self._fields.items() if not re.fullmatch(r"x_plan\d+_id", k)}
        with patch.object(type(self), '_fields', new_callable=PropertyMock) as mocked_fields:
            mocked_fields.return_value = filtered_fields
            yield

    def copy(self, default=None):
        with self._exclude_fake_fields():
            return super().copy(default)

    def _auto_init(self):
        with self._exclude_fake_fields():
            return super()._auto_init()

    def _get_view(self, view_id=None, view_type='form', **options):
        """ Set the correct label for `unit_amount`, depending on company UoM """
        arch, view = super()._get_view(view_id, view_type, **options)
        if view_type == 'search' and self.env['account.analytic.plan'].check_access_rights('read', raise_exception=False):
            group_node = arch.xpath('//group')[0]
            group_node.append(E.separator())
            for plan in self.env['account.analytic.plan'].search([]):
                fname = f"x_plan{plan.id}_id"
                group_node.append(E.filter(name=fname, context=f"{{'group_by': '{fname}'}}"))
            group_node.append(E.separator())
        return arch, view

    def _where_calc(self, domain, active_test=True):
        lat = """LEFT JOIN LATERAL (
                        SELECT account.id
                          FROM account_analytic_account account
                         WHERE account.id = line.account_id
                           AND account.plan_id = {pid}
                                                UNION ALL
                        SELECT account.id
                          FROM analytic_account_composition rel
                          JOIN account_analytic_account account ON account.id = rel.detail_id
                         WHERE line.account_id = rel.aggregate_id
                           AND account.plan_id = {pid}
                         LIMIT 1
                    ) account_plan{pid} ON TRUE
        """
        query = super()._where_calc(domain, active_test)
        if self.env.context.get('advance_analytic_read', True):  # TODO only do when necessary
            if self.env['account.analytic.plan'].check_access_rights('read', raise_exception=False):  # TODO programing error when context managed
                columns = table_columns(self.env.cr, "account_analytic_line")  # TODO cache this
                plan_ids = self.env['account.analytic.plan'].search([]).ids  # TODO cache this
                query._tables[self._table] = f"""
                    SELECT {", ".join("line.%s" % col for col in columns)},
                           {", ".join("account_plan{pid}.id AS x_plan{pid}_id".format(pid=pid) for pid in plan_ids)}
                      FROM account_analytic_line line
                           {"".join(lat.format(pid=pid) for pid in plan_ids)}
                """
        return query
