# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from lxml.builder import E

from odoo import api, fields, models
from odoo.osv.expression import OR
from odoo.tools import frozendict
from odoo.exceptions import ValidationError



class AccountAnalyticLine(models.Model):
    _name = 'account.analytic.line'
    _description = 'Analytic Line'
    _order = 'date desc, id desc'
    _check_company_auto = True

    name = fields.Char(
        'Description',
        compute='_compute_name', store=True, precompute=True, readonly=False,
    )
    date = fields.Date(
        'Date',
        required=True,
        index=True,
        compute='_compute_date', store=True, precompute=True, readonly=False,
    )
    percentage = fields.Float(digits="Percentage Analytic", default=1)
    amount = fields.Monetary(
        'Amount',
        required=True,
        compute='_compute_amount', store=True, precompute=True,
        inverse='_inverse_amount',
    )
    unit_amount = fields.Float(
        'Quantity',
        default=0.0,
        compute='_compute_unit_amount', store=True, precompute=True,
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
    source_document_model = fields.Selection([
        ('analytic.budget', 'Budget'),
        ('account.analytic.distribution.model', 'Analytic Distribution Model'),
    ])
    source_document_id = fields.Many2oneReference(model_field='source_document_model')
    budget_id = fields.Many2oneReferenceField(
        comodel_name='analytic.budget',
        reference_field='source_document_id',
    )
    distribution_model_id = fields.Many2oneReferenceField(
        comodel_name='account.analytic.distribution.model',
        reference_field='source_document_id',
    )
    account_id = fields.Many2one(
        'account.analytic.account',
        'Project Account',
        ondelete='restrict',
        index=True,
        check_company=True,
    )
    # Magic column that represents all the plans at the same time, except for the compute
    # where it is context dependent, and needs the id of the desired plan.
    # Used as a syntactic sugar for search views, and magic field for one2many relation
    auto_account_id = fields.Many2one(
        comodel_name='account.analytic.account',
        string='Analytic Account',
        compute='_compute_auto_account',
        inverse='_inverse_auto_account',
        search='_search_auto_account',
    )
    partner_id = fields.Many2one(
        'res.partner',
        string='Partner',
        check_company=True,
        compute='_compute_partner_id', store=True, precompute=True,
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
        compute='_compute_company_id', store=True, precompute=True,
    )
    currency_id = fields.Many2one(
        related="company_id.currency_id",
        string="Currency",
        readonly=True,
        store=True,
        compute_sudo=True,
    )
    category = fields.Selection(
        [('other', 'Other')],
        compute='_compute_category', store=True, precompute=True,
    )
    state = fields.Selection(
        selection=[
            ('draft', 'Draft'),
            ('posted', 'Posted'),
            ('cancelled', 'Canceled'),
        ],
        compute='_compute_state', store=True, precompute=True,
    )
    line_type = fields.Selection(
        selection=[
            ('1_budget', 'Budget'),
            ('2_commited', 'Commited'),
            ('3_achieved', 'Achieved'),
            ('9_configuration', 'Config'),
        ],
        compute='_compute_line_type', store=True, precompute=True,
        required=True,
    )
    achieved_amount = fields.Monetary(compute='_compute_achieved_amount')
    theoritical_amount = fields.Monetary(compute='_compute_theoritical_amount')
    achievement = fields.Float(compute='_compute_achieved_amount')

    @api.constrains('account_id')
    def _check_account_id(self):
        project_plan, other_plans = self.env['account.analytic.plan']._get_all_plans()
        for line in self:
            if not any(line[plan._column_name()] for plan in project_plan + other_plans):
                raise ValidationError(_("At least one analytic account is required"))

    @api.depends('budget_id.name', 'line_type')
    def _compute_name(self):
        for line in self:
            if line.line_type == '9_configuration':
                line.name = 'something because required'
            else:
                line.name = line.budget_id.name

    def _compute_date(self):
        self.date = fields.Date.context_today(self)

    def _compute_unit_amount(self):
        pass

    def _compute_partner_id(self):
        pass

    def _compute_company_id(self):
        self.company_id = self.env.company

    def _compute_category(self):
        self.category = 'other'

    def _compute_amount(self):
        pass

    def _inverse_amount(self):
        pass

    @api.depends('budget_id.state')
    def _compute_state(self):
        self.state = 'draft'

    @api.depends('budget_id', 'distribution_model_id')
    def _compute_line_type(self):
        for line in self:
            line.line_type = (
                '1_budget' if line.budget_id
                else '9_configuration' if line.distribution_model_id
                else '3_achieved'
            )

    def _compute_achieved_amount(self):
        budget_lines = self.filtered('budget_id')
        other_lines = self - budget_lines
        other_lines.achieved_amount = 0
        other_lines.achievement = 0
        project_plan, other_plans = self.env['account.analytic.plan']._get_all_plans()
        plan_columns = [plan._column_name() for plan in project_plan + other_plans]
        self.env.cr.execute(f"""
            SELECT {','.join(plan_columns)},
                   -SUM(amount) AS sum
              FROM account_analytic_line
             WHERE line_type = 'achieved'
          GROUP BY {','.join(plan_columns)}
        """)
        result = self.env.cr.dictfetchall()

        mapping = {
            frozendict({fname: r[fname] or False for fname in plan_columns}): r['sum']
            for r in result
        }
        for line in budget_lines:
            line.achieved_amount = mapping.get(frozendict({fname: line[fname].id for fname in plan_columns}))
            line.achievement = line.achieved_amount / line.amount

    def _compute_theoritical_amount(self):
        budget_lines = self.filtered('budget_id')
        other_lines = self - budget_lines
        other_lines.theoritical_amount = 0
        today = fields.Date.context_today(self)
        for line in budget_lines:
            start = self.budget_id.start_date
            end = self.budget_id.end_date
            self.theoritical_amount = start and end and line.amount * (1 - ((end - max(start, min(end, today))) / (end-start)))

    @api.depends_context('analytic_plan_id')
    def _compute_auto_account(self):
        plan = self.env['account.analytic.plan'].browse(self.env.context.get('analytic_plan_id'))
        for line in self:
            line.auto_account_id = bool(plan) and line[plan._column_name()]

    def _inverse_auto_account(self):
        for line in self:
            line[line.auto_account_id.plan_id._column_name()] = line.auto_account_id

    def _search_auto_account(self, operator, value):
        project_plan, other_plans = self.env['account.analytic.plan']._get_all_plans()
        return OR([
            [(plan._column_name(), operator, value)]
            for plan in project_plan + other_plans
        ])

    def _patch_view(self, arch, view_type, source_model=None):
        if source_model is not None:  # embedded view from another model
            if arch.find('./tree') is None:
                tree = E.tree()
                tree.append(E.field(name='source_document_model', column_invisible="1"))
                tree.append(E.field(name='source_document_id', column_invisible="1"))
                tree.append(E.field(name='currency_id', column_invisible="1"))
                tree.append(E.field(name='name', optional="hide"))
                tree.append(E.field(name='account_id'))
                tree.append(E.field(name='percentage', widget='percentage'))
                tree.append(E.field(name='amount'))
                arch.append(tree)
            arch.attrib['context'] = str({'default_source_document_model': source_model._name})

        if self.env['account.analytic.plan'].check_access_rights('read', raise_exception=False):
            project_plan, other_plans = self.env['account.analytic.plan']._get_all_plans()

            # Find main account nodes
            account_node = arch.find('.//field[@name="account_id"]')
            account_filter_node = arch.find('.//filter[@name="account_id"]')

            # Force domain on main account node as the fields_get doesn't do the trick
            if account_node is not None and view_type == 'search':
                account_node.set('domain', repr([('plan_id', 'child_of', project_plan.id)]))

            # If there is a main node, append the ones for other plans
            if account_node is not None or account_filter_node is not None:
                for plan in other_plans[::-1]:
                    fname = plan._column_name()
                    if account_node is not None:
                        account_node.addnext(E.field(name=fname, domain=f"[('plan_id', 'child_of', {plan.id})]", optional="show"))
                    if account_filter_node is not None:
                        account_filter_node.addnext(E.filter(name=fname, context=f"{{'group_by': '{fname}'}}"))

    def _get_view(self, view_id=None, view_type='form', **options):
        arch, view = super()._get_view(view_id, view_type, **options)
        self._patch_view(arch, view_type)
        return arch, view

    @api.model
    def fields_get(self, allfields=None, attributes=None):
        fields = super().fields_get(allfields, attributes)
        if self.env['account.analytic.plan'].check_access_rights('read', raise_exception=False):
            project_plan, other_plans = self.env['account.analytic.plan']._get_all_plans()
            for plan in project_plan + other_plans:
                fname = plan._column_name()
                if fname in fields:
                    fields[fname]['string'] = plan.name
                    fields[fname]['domain'] = f"[('plan_id', 'child_of', {plan.id})]"
        return fields
