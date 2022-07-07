# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import itertools
import re
from collections import defaultdict

from odoo import models, fields, api, _, osv
from odoo.exceptions import ValidationError, UserError

FIGURE_TYPE_SELECTION_VALUES = [
    ('monetary', "Monetary"),
    ('percentage', "Percentage"),
    ('integer', "Integer"),
    ('float', "Float"),
    ('date', "Date"),
    ('datetime', "Datetime"),
    ('none', "No Formatting"),
]

class AccountReport(models.Model):
    _name = "account.report"
    _description = "Accounting Report"

    #  CORE ==========================================================================================================================================

    name = fields.Char(string="Name", required=True, translate=True)
    line_ids = fields.One2many(string="Lines", comodel_name='account.report.line', inverse_name='report_id')
    column_ids = fields.One2many(string="Columns", comodel_name='account.report.column', inverse_name='report_id')
    root_report_id = fields.Many2one(string="Root Report", comodel_name='account.report')
    variant_report_ids = fields.One2many(string="Variants", comodel_name='account.report', inverse_name='root_report_id')
    chart_template_id = fields.Many2one(string="Chart of Accounts", comodel_name='account.chart.template')
    country_id = fields.Many2one(string="Country", comodel_name='res.country')
    only_tax_exigible = fields.Boolean(string="Only Tax Exigible Lines")
    caret_options_initializer = fields.Char(string="Caret Options Initializer", required=True, default='get_default_caret_options')
    availability_condition = fields.Selection(
        string="Availability",
        selection=[('country', "Country Matches"), ('coa', "Chart of Accounts Matches"), ('always', "Always")],
        compute='_compute_default_availability_condition', readonly=False, store=True,
    )
    load_more_limit = fields.Integer(string="Load More Limit")
    search_bar = fields.Boolean(string="Search Bar")

    default_opening_date_filter = fields.Selection(
        string="Default Opening",
        selection=[
            ('this_year', "This Year"), ('this_quarter', "This Quarter"), ('this_month', "This Month"), ('today', "Today"),
            ('last_month', "Last Month"), ('last_quarter', "Last Quarter"), ('last_year', "Last Year"),
        ],
        compute=lambda x: x._compute_report_option_filter('default_opening_date_filter', 'last_month'),
        readonly=False, store=True, depends=['root_report_id'],
    )

    #  FILTERS =======================================================================================================================================
    # Those fields control the display of menus on the report

    filter_multi_company = fields.Selection(
        string="Multi-Company",
        selection=[('disabled', "Disabled"), ('selector', "Use Company Selector"), ('tax_units', "Use Tax Units")],
        compute=lambda x: x._compute_report_option_filter('filter_multi_company', 'disabled'), readonly=False, store=True, depends=['root_report_id'],
    )
    filter_date_range = fields.Boolean(
        string="Date Range",
        compute=lambda x: x._compute_report_option_filter('filter_date_range', True), readonly=False, store=True, depends=['root_report_id'],
    )
    filter_show_draft = fields.Boolean(
        string="Draft Entries",
        compute=lambda x: x._compute_report_option_filter('filter_show_draft', True), readonly=False, store=True, depends=['root_report_id'],
    )
    filter_unreconciled = fields.Boolean(
        string="Unreconciled Entries",
        compute=lambda x: x._compute_report_option_filter('filter_unreconciled', False), readonly=False, store=True, depends=['root_report_id'],
    )
    filter_unfold_all = fields.Boolean(
        string="Unfold All",
        compute=lambda x: x._compute_report_option_filter('filter_unfold_all'), readonly=False, store=True, depends=['root_report_id'],
    )
    filter_period_comparison = fields.Boolean(
        string="Period Comparison",
        compute=lambda x: x._compute_report_option_filter('filter_period_comparison', True), readonly=False, store=True, depends=['root_report_id'],
    )
    filter_growth_comparison = fields.Boolean(
        string="Growth Comparison",
        compute=lambda x: x._compute_report_option_filter('filter_growth_comparison', True), readonly=False, store=True, depends=['root_report_id'],
    )
    filter_journals = fields.Boolean(
        string="Journals",
        compute=lambda x: x._compute_report_option_filter('filter_journals'), readonly=False, store=True, depends=['root_report_id'],
    )
    filter_analytic = fields.Boolean(
        string="Filter Analytic",
        compute=lambda x: x._compute_report_option_filter('filter_analytic'), readonly=False, store=True, depends=['root_report_id'],
    )
    filter_hierarchy = fields.Selection(
        string="Account Groups",
        selection=[('by_default', "Enabled by Default"), ('optional', "Optional"), ('never', "Never")],
        compute=lambda x: x._compute_report_option_filter('filter_hierarchy', 'never'), readonly=False, store=True, depends=['root_report_id'],
    )
    filter_account_type = fields.Boolean(
        string="Account Types",
        compute=lambda x: x._compute_report_option_filter('filter_account_type'), readonly=False, store=True, depends=['root_report_id'],
    )
    filter_partner = fields.Boolean(
        string="Partners",
        compute=lambda x: x._compute_report_option_filter('filter_partner'), readonly=False, store=True, depends=['root_report_id'],
    )
    filter_fiscal_position = fields.Boolean(
        string="Filter Multivat",
        compute=lambda x: x._compute_report_option_filter('filter_fiscal_position'), readonly=False, store=True, depends=['root_report_id'],
    )

    #  CUSTOM REPORTS ================================================================================================================================
    # Those fields allow case-by-case fine-tuning or the engine, for custom reports

    dynamic_lines_generator = fields.Char(string="Dynamic Lines Generator")
    custom_options_initializer = fields.Char(
        string="Custom Options Initializer",
        compute=lambda x: x._compute_report_option_filter('custom_options_initializer'), readonly=False, store=True, depends=['root_report_id'],
    )
    custom_line_postprocessor = fields.Char(string="Custom Line Postprocessor")
    custom_groupby_line_completer = fields.Char(string="Custom Groupby Line Completer")
    custom_unfold_all_batch_data_generator = fields.Char(string="Custom Unfold All Batch Data Generator")

    def _compute_report_option_filter(self, field_name, default_value=False):
        # We don't depend on the different filter fields on the root report, as we don't want a manual change on it to be reflected on all the reports
        # using it as their root (would create confusion). The root report filters are only used as some kind of default values.
        for record in self:
            if record.root_report_id:
                record[field_name] = record.root_report_id[field_name]
            else:
                record[field_name] = default_value

    @api.depends('root_report_id', 'country_id')
    def _compute_default_availability_condition(self):
        for record in self:
            if record.root_report_id:
                record.availability_condition = 'country'
            else:
                record.availability_condition = 'always'

    @api.constrains('root_report_id')
    def _validate_root_report_id(self):
        for record in self:
            if record.root_report_id.root_report_id:
                raise ValidationError(_("Only a report without a root report of its own can be selected as root report."))

    def write(self, vals):
        # Overridden so that changing the country of a report also creates new tax tags if necessary, or updates the country
        # of existing tags, if they aren't shared with another report.
        if 'country_id' in vals:
            tags_cache = {}
            impacted_reports = self.filtered(lambda x: x.country_id.id != vals['country_id'])
            tax_tags_expressions = impacted_reports.line_ids.expression_ids.filtered(lambda x: x.engine == 'tax_tags')

            for expression in tax_tags_expressions:
                tax_tags = self.env['account.account.tag']._get_tax_tags(expression.formula, expression.report_line_id.report_id.country_id.id)
                tag_reports = tax_tags._get_related_tax_report_expressions().report_line_id.report_id

                if all(report in self for report in tag_reports):
                    # Only reports in self are using these tags; let's change their country
                    tax_tags.write({'country_id': vals['country_id']})
                else:
                    # Another report uses these tags as well; let's keep them and create new tags in the target country
                    tag_vals = self.env['account.report.expression']._get_tags_create_vals(expression.formula, vals['country_id'])
                    self.env['account.account.tag'].create(tag_vals)

        return super().write(vals)

    def copy(self, default=None):
        '''Copy the whole financial report hierarchy by duplicating each line recursively.

        :param default: Default values.
        :return: The copied account.report record.
        '''
        self.ensure_one()
        if default is None:
            default = {}
        default.update({'name': self._get_copied_name()})
        copied_report = super().copy(default=default)
        code_mapping = {}
        for line in self.line_ids.filtered(lambda x: not x.parent_id):
            line._copy_hierarchy(code_mapping, report=self, copied_report=copied_report)
        return copied_report

    def _get_copied_name(self):
        '''Return a copied name of the account.report record by adding the suffix (copy) at the end
        until the name is unique.

        :return: an unique name for the copied account.report
        '''
        self.ensure_one()
        name = self.name + ' ' + _('(copy)')
        while self.search_count([('name', '=', name)]) > 0:
            name += ' ' + _('(copy)')
        return name


class AccountReportLine(models.Model):
    _name = "account.report.line"
    _description = "Accounting Report Line"
    _order = 'sequence, id'

    name = fields.Char(string="Name", required=True)
    expression_ids = fields.One2many(string="Expressions", comodel_name='account.report.expression', inverse_name='report_line_id')
    report_id = fields.Many2one(
        string="Parent Report",
        comodel_name='account.report',
        compute='_compute_report_id',
        store=True,
        readonly=False,
        required=True,
        recursive=True,
        precompute=True,
        ondelete='cascade'
    )
    parent_id = fields.Many2one(string="Parent Line", comodel_name='account.report.line', ondelete='set null')
    children_ids = fields.One2many(string="Child Lines", comodel_name='account.report.line', inverse_name='parent_id')
    groupby = fields.Char(string="Group By")
    sequence = fields.Integer(string="Sequence")
    hierarchy_level = fields.Integer(string="Level", compute='_compute_hierarchy_level', store=True, readonly=False, recursive=True)
    code = fields.Char(string="Code")
    foldable = fields.Boolean(string="Foldable", help="By default, we always unfold the lines that can be. If this is checked; the line won't be unfolded by default, and a folding button will be displayed")
    print_on_new_page = fields.Boolean('Print On New Page', help='When checked this line and everything after it will be printed on a new page.')
    action_id = fields.Many2one(string="Action", comodel_name='ir.actions.actions')
    hide_if_zero = fields.Boolean(string="Hide if Zero", help="This line and its children will be hidden when all its columns are 0.")

    _sql_constraints = [
        ('code_uniq', 'unique (code)', "A report line with the same code already exists."),
    ]

    @api.depends('parent_id.hierarchy_level')
    def _compute_hierarchy_level(self):
        for record in self:
            if record.parent_id:
                record.hierarchy_level = record.parent_id.hierarchy_level + 2
            else:
                record.hierarchy_level = 1

    @api.depends('parent_id.report_id')
    def _compute_report_id(self):
        for record in self:
            if record.parent_id:
                record.report_id = record.parent_id.report_id

    @api.constrains('parent_id')
    def _validate_groupby_no_child(self):
        for record in self:
            if record.parent_id.groupby:
                raise ValidationError(_("A line cannot have both children and a groupby value (line '%s').", record.parent_id.name))

    @api.constrains('expression_ids', 'groupby')
    def _validate_formula(self):
        for expression in self.expression_ids:
            if expression.engine == 'aggregation':
                if expression.report_line_id.groupby:
                    raise ValidationError(_("Groupby feature isn't supported by aggregation engine."))

    def _copy_hierarchy(self, code_mapping, report=None, copied_report=None, parent=None):
        ''' Copy the whole hierarchy from this line by copying each line children recursively and adapting the
        formulas with the new copied codes.

        :param report: The financial report that triggered the duplicate.
        :param copied_report: The copy of the report.
        :param parent: The parent line in the hierarchy (a copy of the original parent line).
        :param code_mapping: A dictionary keeping track of mapping old_code -> new_code
        '''
        self.ensure_one()

        # If the line points to the old report, replace with the new one.
        # Otherwise, cut the link to another financial report.
        if report and copied_report and self.report_id.id == report.id:
            report_id = copied_report.id
        else:
            report_id = None

        copied_line = self.copy({
            'report_id': report_id,
            'parent_id': parent and parent.id,
            'code': self.code and self._get_copied_code(),
        })

        # Keep track of old_code -> new_code in a mutable dict
        if self.code:
            code_mapping[self.code] = copied_line.code

        # Copy children
        for line in self.children_ids:
            line._copy_hierarchy(parent=copied_line, code_mapping=code_mapping)

        # Update aggregation expressions, so that they use the copied lines
        for expression in self.expression_ids:
            copy_defaults = {
                'report_line_id': copied_line.id,
            }

            if expression.engine == 'aggregation':
                copied_formula = f" {expression.formula} " # Add spaces so that the lookahead/lookbehind of the regex can work (we can't do a | in those)
                for old_code, new_code in code_mapping.items():
                    copied_formula = re.sub(f"(?<=\\W){old_code}(?=\\W)", new_code, copied_formula)
                copy_defaults['formula'] = copied_formula.strip() # Remove the spaces introduced for lookahead/lookbehind

            expression.copy(copy_defaults)

    def _get_copied_code(self):
        '''Look for an unique copied code.

        :return: an unique code for the copied account.report.line
        '''
        self.ensure_one()
        code = self.code + '_COPY'
        while self.search_count([('code', '=', code)]) > 0:
            code += '_COPY'
        return code


class AccountReportExpression(models.Model):
    _name = "account.report.expression"
    _description = "Accounting Report Expression"

    report_line_id = fields.Many2one(string="Report Line", comodel_name='account.report.line', required=True, ondelete='cascade')
    label = fields.Char(string="Label", required=True)
    engine = fields.Selection(
        string="Computation Engine",
        selection = [
            ('domain', "Odoo Domain"),
            ('tax_tags', "Tax Tags"),
            ('aggregation', "Aggregate Other Formulas"),
            ('account_codes', "Prefix of Account Codes"),
            ('external', "External Value"),
            ('custom', "Custom Python Function"),
        ],
        required=True
    )
    formula = fields.Char(string="Formula", required=True)
    subformula = fields.Char(string="Subformula")
    date_scope = fields.Selection(
        string="Date Scope",
        selection=[
            ('from_beginning', 'From the very start'),
            ('from_fiscalyear', 'From the start of the fiscal year'),
            ('to_beginning_of_period', 'At the beginning of the period'),
            ('normal', 'According to each type of account'),
            ('strict_range', 'Strictly on the given dates'),
            ('previous_tax_period', "From previous tax period")
        ],
        required=True,
        default='strict_range',
    )
    figure_type = fields.Selection(string="Figure Type", selection=FIGURE_TYPE_SELECTION_VALUES)
    green_on_positive = fields.Boolean(string="Is Growth Good when Positive", default=True)
    blank_if_zero = fields.Boolean(string="Blank if Zero")
    auditable = fields.Boolean(string="Auditable", store=True, readonly=False, compute='_compute_auditable')

    # Carryover fields
    carryover_target = fields.Char(
        string="Carry Over To",
        help="Formula in the form line_code.expression_label. This allows setting the target of the carryover for this expression "
             "(on a _carryover_*-labeled expression), in case it is different from the parent line."
    )

    @api.depends('engine')
    def _compute_auditable(self):
        auditable_engines = self._get_auditable_engines()
        for record in self:
            record.auditable = record.engine in auditable_engines

    def _get_auditable_engines(self):
        return {'tax_tags', 'domain', 'account_codes', 'external', 'aggregation'}

    @api.model_create_multi
    def create(self, vals_list):
        # Overridden so that we create the corresponding account.account.tag objects when instantiating an expression
        # with engine 'tax_tags'.
        rslt = super().create(vals_list)

        for record in rslt:
            tag_name = record.formula if record.engine == 'tax_tags' else None
            if tag_name:
                country = record.report_line_id.report_id.country_id
                existing_tags = self.env['account.account.tag']._get_tax_tags(tag_name, country.id)

                if not existing_tags:
                    tag_vals = self._get_tags_create_vals(tag_name, country.id)
                    self.env['account.account.tag'].create(tag_vals)

        return rslt

    def write(self, vals):
        if 'formula' in vals:
            tax_tags_expressions = self.filtered(lambda x: x.engine == 'tax_tags')
            former_formulas_by_country = defaultdict(lambda: [])
            for expr in tax_tags_expressions:
                former_formulas_by_country[expr.report_line_id.report_id.country_id].append(expr.formula)

            rslt = super().write(vals)

            for country, former_formulas_list in former_formulas_by_country.items():
                for former_formula in former_formulas_list:
                    new_tax_tags = self.env['account.account.tag']._get_tax_tags(vals['formula'], country.id)

                    if not new_tax_tags:
                        # If new tags already exist, nothing to do ; else, we must create them or update existing tags.
                        former_tax_tags = self.env['account.account.tag']._get_tax_tags(former_formula, country.id)

                        if former_tax_tags and all(tag_expr in self for tag_expr in former_tax_tags._get_related_tax_report_expressions()):
                            # If we're changing the formula of all the expressions using that tag, rename the tag
                            negative_tags = former_tax_tags.filtered(lambda x: x.tax_negate)
                            negative_tags.write({'name': '-%s' % vals['formula']})
                            (former_tax_tags - negative_tags).write({'name': '+%s' % vals['formula']})
                        else:
                            # Else, create a new tag. Its the compute functions will make sure it is properly linked to the expressions
                            tag_vals = self.env['account.report.expression']._get_tags_create_vals(vals['formula'], country.id)
                            self.env['account.account.tag'].create(tag_vals)
        else:
            rslt = super().write(vals)

        return rslt

    def _expand_aggregations(self):
        """ Returns a recordset containning all the expressions in self + all the expressions the aggregation expressions contained in self
        depend on. This is done recursively, so if an aggregation depends on other aggregations, they will be expanded as well in the result, so that
        we ensure all expressions in the resulting set can be fully evaluated together.
        """
        rslt = self

        to_expand = self.filtered(lambda x: x.engine == 'aggregation')
        while to_expand:
            domains = []

            for candidate_expr in to_expand:
                labels_by_code = candidate_expr._get_aggregation_terms_details()

                cross_report_domain = []
                if candidate_expr.subformula != 'cross_report':
                    cross_report_domain = [('report_line_id.report_id', '=', candidate_expr.report_line_id.report_id.id)]

                for line_code, expr_labels in labels_by_code.items():
                    dependency_domain = [('report_line_id.code', '=', line_code), ('label', 'in', tuple(expr_labels))] + cross_report_domain
                    domains.append(dependency_domain)

            sub_expressions = self.env['account.report.expression'].search(osv.expression.OR(domains))
            to_expand = sub_expressions.filtered(lambda x: x.engine == 'aggregation' and x not in rslt)
            rslt |= sub_expressions

        return rslt

    def _get_aggregation_terms_details(self):
        """ Computes the details of each aggregation expression in self, and returns them in the form of a single dict aggregating all the results.

        Example of aggreation details:
        formula 'A.balance + B.balance + A.other'
        will return: {'A': {'balance', 'other'}, 'B': {'balance'}}
        """
        totals_by_code = defaultdict(set)
        for expression in self:
            if expression.engine != 'aggregation':
                raise UserError(_("Cannot get aggregation details from a line not using 'aggregation' engine"))

            expression_terms = re.split('[-+/*]', expression.formula.replace(' ', '')) # TODO une constante pour les opérateurs admis à l'aggrégation ?
            for term in expression_terms:
                if term: # term might be empty if the formula contains a negative term
                    line_code, total_name = term.split('.')
                    totals_by_code[line_code].add(total_name)

        return totals_by_code

    def _get_matching_tags(self):
        """ Returns all the signed account.account.tags records whose name matches any of the formulas of the tax_tags expressions contained in self.
        """
        tag_expressions = self.filtered(lambda x: x.engine == 'tax_tags')
        if not tag_expressions:
            return self.env['account.account.tag']

        or_domains = []
        for tag_expression in tag_expressions:
            country = tag_expression.report_line_id.report_id.country_id
            or_domains.append(self.env['account.account.tag']._get_tax_tags_domain(tag_expression.formula, country.id))

        return self.env['account.account.tag'].search(osv.expression.OR(or_domains))

    @api.model
    def _get_tags_create_vals(self, tag_name, country_id):
        minus_tag_vals = {
          'name': '-' + tag_name,
          'applicability': 'taxes',
          'tax_negate': True,
          'country_id': country_id,
        }
        plus_tag_vals = {
          'name': '+' + tag_name,
          'applicability': 'taxes',
          'tax_negate': False,
          'country_id': country_id,
        }
        return [(minus_tag_vals), (plus_tag_vals)]

    def _get_carryover_target_expression(self):
        self.ensure_one()

        if self.carryover_target:
            line_code, expr_label = self.carryover_target.split('.')
            return self.env['account.report.expression'].search([
                ('report_line_id.code', '=', line_code),
                ('label', '=', expr_label),
                ('report_line_id.report_id', '=', self.report_line_id.report_id.id),
            ])

        main_expr_label = re.sub("^_carryover_", '', self.label)
        target_label = '_applied_carryover_%s' % main_expr_label
        auto_chosen_target = self.report_line_id.expression_ids.filtered(lambda x: x.label == target_label)

        if not auto_chosen_target:
            raise UserError(_("Could not determine carryover target automatically for expression %s.", self.label))

        return auto_chosen_target


class AccountReportColumn(models.Model):
    _name = "account.report.column"
    _description = "Accounting Report Column"
    _order = 'sequence, id'

    name = fields.Char(string="Name", required=True)
    expression_label = fields.Char(string="Expression Label", required=True)
    sequence = fields.Integer(string="Sequence")
    report_id = fields.Many2one(string="Report", comodel_name='account.report')
    sortable = fields.Boolean(string="Sortable")
    figure_type = fields.Selection(string="Figure Type", selection=FIGURE_TYPE_SELECTION_VALUES, default="monetary", required=True)
    blank_if_zero = fields.Boolean(string="Blank if Zero", default=True)


class AccountReportExternalValue(models.Model):
    _name = "account.report.external.value"
    _description = 'Accounting Report External Value'
    _check_company_auto = True

    name = fields.Char(required=True)
    value = fields.Float(required=True)
    date = fields.Date(required=True)

    target_report_expression_id = fields.Many2one(string="Target Expression", comodel_name="account.report.expression", required=True)
    target_report_line_id = fields.Many2one(string="Target Line", related="target_report_expression_id.report_line_id")
    target_report_expression_label = fields.Char(string="Target Expression Label", related="target_report_expression_id.label")
    report_country_id = fields.Many2one(string="Country", related='target_report_line_id.report_id.country_id')

    company_id = fields.Many2one(string='Company', comodel_name='res.company', required=True, default=lambda self: self.env.company)

    foreign_vat_fiscal_position_id = fields.Many2one(
        string="Fiscal position",
        comodel_name='account.fiscal.position',
        domain="[('company_id', '=', company_id), ('country_id', '=', report_country_id), ('foreign_vat', '!=', False)]",
        check_company=True,
        help="The foreign fiscal position for which this external value is made.",
    )

    # Carryover fields
    carryover_origin_expression_label = fields.Char(string="Origin Expression Label")
    carryover_origin_report_line_id = fields.Many2one(string="Origin Line", comodel_name='account.report.line')


    @api.constrains('foreign_vat_fiscal_position_id', 'target_report_expression_id')
    def _check_fiscal_position(self):
        for record in self:
            if record.foreign_vat_fiscal_position_id and record.foreign_vat_fiscal_position_id.country_id != record.report_country_id:
                raise ValidationError(_("The country set on the the foreign VAT fiscal position must match the one set on the report."))
