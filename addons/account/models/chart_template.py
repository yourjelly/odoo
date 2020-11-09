# -*- coding: utf-8 -*-

from odoo.exceptions import AccessError
from odoo import api, fields, models, _
from odoo import SUPERUSER_ID
from odoo.exceptions import UserError, ValidationError
from odoo.http import request
from odoo.addons.account.models.account_tax import TYPE_TAX_USE
from odoo.models import MAGIC_COLUMNS
from odoo.osv import expression

import logging

_logger = logging.getLogger(__name__)

def migrate_set_tags_and_taxes_updatable(cr, registry, module):
    ''' This is a utility function used to manually set the flag noupdate to False on tags and account tax templates on localization modules
    that need migration (for example in case of VAT report improvements)
    '''
    env = api.Environment(cr, SUPERUSER_ID, {})
    xml_record_ids = env['ir.model.data'].search([
        ('model', 'in', ['account.tax.template', 'account.account.tag']),
        ('module', 'like', module)
    ]).ids
    if xml_record_ids:
        cr.execute("update ir_model_data set noupdate = 'f' where id in %s", (tuple(xml_record_ids),))

def preserve_existing_tags_on_taxes(cr, registry, module):
    ''' This is a utility function used to preserve existing previous tags during upgrade of the module.'''
    env = api.Environment(cr, SUPERUSER_ID, {})
    xml_records = env['ir.model.data'].search([('model', '=', 'account.account.tag'), ('module', 'like', module)])
    if xml_records:
        cr.execute("update ir_model_data set noupdate = 't' where id in %s", [tuple(xml_records.ids)])

#  ---------------------------------------------------------------
#   Account Templates: Account, Tax, Tax Code and chart. + Wizard
#  ---------------------------------------------------------------


class AccountGroupTemplate(models.Model):
    _name = "account.group.template"
    _description = 'Template for Account Groups'
    _order = 'code_prefix_start'

    parent_id = fields.Many2one('account.group.template', index=True, ondelete='cascade')
    name = fields.Char(required=True)
    code_prefix_start = fields.Char()
    code_prefix_end = fields.Char()
    chart_template_id = fields.Many2one('account.chart.template', string='Chart Template', required=True)


class AccountAccountTemplate(models.Model):
    _name = "account.account.template"
    _description = 'Templates for Accounts'
    _order = "code"

    name = fields.Char(required=True, index=True)
    currency_id = fields.Many2one('res.currency', string='Account Currency', help="Forces all moves for this account to have this secondary currency.")
    code = fields.Char(size=64, required=True, index=True)
    user_type_id = fields.Many2one('account.account.type', string='Type', required=True,
        help="These types are defined according to your country. The type contains more information "\
        "about the account and its specificities.")
    reconcile = fields.Boolean(string='Allow Invoices & payments Matching', default=False,
        help="Check this option if you want the user to reconcile entries in this account.")
    note = fields.Text()
    tax_ids = fields.Many2many('account.tax.template', 'account_account_template_tax_rel', 'account_id', 'tax_id', string='Default Taxes')
    nocreate = fields.Boolean(string='Optional Create', default=False,
        help="If checked, the new chart of accounts will not contain this by default.")
    chart_template_id = fields.Many2one('account.chart.template', string='Chart Template',
        help="This optional field allow you to link an account template to a specific chart template that may differ from the one its root parent belongs to. This allow you "
            "to define chart templates that extend another and complete it with few new accounts (You don't need to define the whole structure that is common to both several times).")
    tag_ids = fields.Many2many('account.account.tag', 'account_account_template_account_tag', string='Account tag', help="Optional tags you may want to assign for custom reporting")

    @api.depends('name', 'code')
    def name_get(self):
        res = []
        for record in self:
            name = record.name
            if record.code:
                name = record.code + ' ' + name
            res.append((record.id, name))
        return res


class AccountChartTemplate(models.Model):
    _name = "account.chart.template"
    _description = "Account Chart Template"

    name = fields.Char(required=True)
    parent_id = fields.Many2one('account.chart.template', string='Parent Chart Template')
    code_digits = fields.Integer(string='# of Digits', required=True, default=6, help="No. of Digits to use for account code")
    visible = fields.Boolean(string='Can be Visible?', default=True,
        help="Set this to False if you don't want this template to be used actively in the wizard that generate Chart of Accounts from "
            "templates, this is useful when you want to generate accounts of this template only when loading its child template.")
    currency_id = fields.Many2one('res.currency', string='Currency', required=True)
    use_anglo_saxon = fields.Boolean(string="Use Anglo-Saxon accounting", default=False)
    complete_tax_set = fields.Boolean(string='Complete Set of Taxes', default=True,
        help="This boolean helps you to choose if you want to propose to the user to encode the sale and purchase rates or choose from list "
            "of taxes. This last choice assumes that the set of tax defined on this template is complete")
    account_ids = fields.One2many('account.account.template', 'chart_template_id', string='Associated Account Templates')
    tax_template_ids = fields.One2many('account.tax.template', 'chart_template_id', string='Tax Template List',
        help='List of all the taxes that have to be installed by the wizard')
    bank_account_code_prefix = fields.Char(string='Prefix of the bank accounts', required=True)
    cash_account_code_prefix = fields.Char(string='Prefix of the main cash accounts', required=True)
    transfer_account_code_prefix = fields.Char(string='Prefix of the main transfer accounts', required=True)
    income_currency_exchange_account_id = fields.Many2one('account.account.template',
        string="Gain Exchange Rate Account", domain=[('internal_type', '=', 'other'), ('deprecated', '=', False)])
    expense_currency_exchange_account_id = fields.Many2one('account.account.template',
        string="Loss Exchange Rate Account", domain=[('internal_type', '=', 'other'), ('deprecated', '=', False)])
    account_journal_suspense_account_id = fields.Many2one('account.account.template', string='Journal Suspense Account')
    default_cash_difference_income_account_id = fields.Many2one('account.account.template', string="Cash Difference Income Account")
    default_cash_difference_expense_account_id = fields.Many2one('account.account.template', string="Cash Difference Expense Account")
    default_pos_receivable_account_id = fields.Many2one('account.account.template', string="PoS receivable account")
    property_account_receivable_id = fields.Many2one('account.account.template', string='Receivable Account')
    property_account_payable_id = fields.Many2one('account.account.template', string='Payable Account')
    property_account_expense_categ_id = fields.Many2one('account.account.template', string='Category of Expense Account')
    property_account_income_categ_id = fields.Many2one('account.account.template', string='Category of Income Account')
    property_account_expense_id = fields.Many2one('account.account.template', string='Expense Account on Product Template')
    property_account_income_id = fields.Many2one('account.account.template', string='Income Account on Product Template')
    property_stock_account_input_categ_id = fields.Many2one('account.account.template', string="Input Account for Stock Valuation")
    property_stock_account_output_categ_id = fields.Many2one('account.account.template', string="Output Account for Stock Valuation")
    property_stock_valuation_account_id = fields.Many2one('account.account.template', string="Account Template for Stock Valuation")
    property_tax_payable_account_id = fields.Many2one('account.account.template', string="Tax current account (payable)")
    property_tax_receivable_account_id = fields.Many2one('account.account.template', string="Tax current account (receivable)")
    property_advance_tax_payment_account_id = fields.Many2one('account.account.template', string="Advance tax payment account")
    property_cash_basis_base_account_id = fields.Many2one(
        comodel_name='account.account.template',
        domain=[('deprecated', '=', False)],
        string="Base Tax Received Account",
        help="Account that will be set on lines created in cash basis journal entry and used to keep track of the "
             "tax base amount.")

    # -------------------------------------------------------------------------
    # HELPERS
    # -------------------------------------------------------------------------

    def _get_chart_template_hierarchy(self):
        ''' Flatten the hierarchy of chart of accounts in order to retrieve all templates linked to them.
        :return: An account.chart.template recorset.
        '''
        self.ensure_one()
        chart_templates = self
        chart_template = self
        while chart_template.parent_id:
            chart_template = chart_template.parent_id
            chart_templates |= chart_template
        return chart_templates

    @api.model
    def existing_accounting(self, company):
        ''' Check if there is already some booked journal items in the current company.
        :param company: A res.company record.
        :return         A boolean indicating if there is some journal items or not.
        '''
        return bool(self.env['account.move.line'].sudo().search([
            ('company_id', '=', company.id),
            ('parent_state', '=', 'posted'),
        ], limit=1))

    @api.model
    def _cleanup_existing_accounting(self, company):
        ''' Helper to clean all remaining things coming from a previous chart template.
        :param company: A res.company record.
        '''
        self.ensure_one()

        models_to_cleanup = [
            'account.reconcile.model',
            'account.fiscal.position',
            'account.tax',
            'account.move',
            'account.journal',
            'account.group',
        ]
        property_to_cleanup_domains = []
        for model in models_to_cleanup:
            self.env[model].sudo().search([('company_id', '=', company.id)]).unlink()
            property_to_cleanup_domains.append([('value_reference', 'like', 'account.journal,%')])

        self.env['ir.property'].sudo()\
            .search([('company_id', '=', company.id)] + expression.OR(property_to_cleanup_domains))\
            .unlink()

    @api.model
    def _prepare_payment_acquirer_account(self, company, **kwargs):
        ''' Hook used to generate the transfer account for payment acquirer.
        :param company:     The company owning this account.
        :kwargs:            Additional values to be added to vals.
        :return:            A dictionary of values to create a new account.account.
        '''
        digits = len(company.transfer_account_id.code or '')
        return {
            'name': _("Transfer"),
            'code': self.env['account.account']._search_new_account_code(company, digits, company.transfer_account_code_prefix),
            'user_type_id': self.env.ref('account.data_account_type_current_assets').id,
            'reconcile': True,
            'company_id': company.id,
        }

    # -------------------------------------------------------------------------
    # COA TEMPLATE INSTALLATION
    # -------------------------------------------------------------------------

    @api.model
    def _get_coa_record_fields(self, template_model, target_model, excluded_fields=[]):
        ''' Helper used to retrieve all ir.model.fields to be used on the targeted model.

        :param template_model:  The model of the template. E.g. self.env['account.account.template'].
        :param target_model:    The model of the record to be created. E.g. self.env['account.account'].
        :param excluded_fields: The name of fields to be excluded.
        :return:                An ir.model.fields recordset.
        '''
        protected_fields = set(MAGIC_COLUMNS + [self.CONCURRENCY_CHECK_FIELD] + excluded_fields)
        valid_fields = set(target_model._fields.keys())
        return [field
                for field in template_model._fields.values()
                if field.name not in protected_fields and field.name in valid_fields]

    def _prepare_coa_record_field_value(self, company, template, target_model, field, loaded_data):
        if field.type == 'many2many' and field.comodel_name in loaded_data:
            loaded_records = loaded_data[field.comodel_name]['records']
            return [(6, 0, [loaded_records[record] for record in template[field.name]])]
        elif field.type == 'one2many' and field.comodel_name in loaded_data:
            target_model = loaded_data[field.comodel_name]['model']
            sub_fields = self._get_coa_record_fields(template[field.name], target_model, excluded_fields=[field.inverse_name])
            # Note: delaying field for sub-records in a one2many field is not supported.
            return [(0, 0, self._prepare_coa_record_create_vals(company, record, target_model, sub_fields, loaded_data)[0])
                                for record in template[field.name]]
        elif field.type == 'many2one' and field.comodel_name in loaded_data:
            record = loaded_data[field.comodel_name]['records'].get(template[field.name], False)
            return record and record.id or False
        else:
            return field.convert_to_write(template[field.name], template)

    @api.model
    def _prepare_coa_record_create_vals(self, company, template, target_model, fields, loaded_data):
        vals = {}
        delayed_fields = []
        for field in fields:

            # Reference to another template that is not already loaded.
            # If the field is empty, no need to wait to set a value for performance reason.
            if field.type in ('many2one', 'many2many')\
                    and field.comodel_name in loaded_data \
                    and not loaded_data[field.comodel_name].get('records'):

                if field.type == 'many2one':
                    vals[field.name] = False
                else: # field.type == 'many2many'.
                    vals[field.name] = [(6, 0, [])]

                # Delay the value for this field.
                if template[field.name]:
                    delayed_fields.append(field)

            else:
                vals[field.name] = self._prepare_coa_record_field_value(company, template, target_model, field, loaded_data)

        if 'company_id' in target_model._fields:
            vals['company_id'] = company.id

        return vals, delayed_fields

    @api.model
    def _prepare_coa_record_update_vals(self, template, delayed_fields, loaded_data):
        return {field.name: self._prepare_coa_record_field_value(template, field, loaded_data) for field in delayed_fields}

    def _create_coa_records_with_xml_ids(self, company, templates, target_model, create_vals_list):
        template_xmlids = templates.get_external_id()
        data_list = []
        for template, vals in zip(templates, create_vals_list):
            module, name = template_xmlids[template.id].split('.', 1)
            xml_id = '%s.%s_%s' % (module, company.id, name)
            data_list.append({
                'xml_id': xml_id,
                'values': vals,
                'noupdate': True,
            })
        return target_model._load_records(data_list)

    def _install_coa(self, company):
        self.ensure_one()

        all_coa = self._get_chart_template_hierarchy()

        # Tracking of generated templates/records.
        # /!\ The order is really important for performances since a template could depend to another one.
        # So, the templates must be loaded in order to create them with the minimum number of delayed fields because
        # those are updated using a record by record 'write'.
        to_load = [
            ('account.group.template', {
                'model': self.env['account.group'],
                'records': {},
            }),
            ('account.account.template', {
                'model': self.env['account.account'],
                'records': {},
            }),
            ('account.tax.template', {
                'model': self.env['account.tax'],
                'records': {},
            }),
            ('account.tax.repartition.line.template', {
                'model': self.env['account.tax.repartition.line'],
            }),
            ('account.fiscal.position.template', {
                'model': self.env['account.fiscal.position'],
                'records': {},
            }),
            ('account.fiscal.position.tax.template', {'model': self.env['account.fiscal.position.tax']}),
            ('account.fiscal.position.account.template', {'model': self.env['account.fiscal.position.account']}),
        ]
        loaded_data = dict(to_load)

        records_to_post_fix = []
        for template_model_name, data in to_load:
            if 'records' not in data:
                continue

            template_model = self.env[template_model_name]
            target_model = data['model']

            # Determine the full list of fields to be populated for new records.
            # Then, dispatch them into two groups:
            # - create_fields:  The list of field used to populate the dictionary of vals that will be used to create
            #                   the record.
            # - delayed_fields: The list of field referencing another template model that isn't already loaded.
            all_fields = self._get_coa_record_fields(template_model, target_model)

            templates = self.env[template_model_name]\
                .with_context(active_test=False)\
                .search([('chart_template_id', 'in', all_coa.ids)])
            create_vals_list = []
            delayed_fields_list = []
            for template in templates:
                vals, delayed_fields = self._prepare_coa_record_create_vals(company, template, target_model, all_fields, loaded_data)

                # === Collect special data for later use ===

                if template_model_name == 'account.account.template':
                    if vals.get('code'):
                        vals['code'] = vals['code'].ljust(self.code_digits, '0')

                create_vals_list.append(vals)
                delayed_fields_list.append(delayed_fields)

            records = self._create_coa_records_with_xml_ids(company, templates, target_model, create_vals_list)
            for template, record, delayed_fields in zip(templates, records, delayed_fields_list):
                data['records'][template] = record
                if delayed_fields:
                    records_to_post_fix.append((template, record, delayed_fields))

        # Post-fix all delayed fields.
        for template, record, delayed_fields in records_to_post_fix:
            record.write(self._prepare_coa_record_update_vals(template, delayed_fields, loaded_data))

        return loaded_data

    def _prepare_journals(self, company, loaded_data):
        self.ensure_one()
        accounts_mapping = loaded_data['account.account.template']['records']

        if self.property_account_income_categ_id:
            income_account_id = accounts_mapping[self.property_account_income_categ_id].id
        else:
            income_account_id = False

        if self.property_account_expense_categ_id:
            expense_account_id = accounts_mapping[self.property_account_expense_categ_id].id
        else:
            expense_account_id = False

        return [
            {
                'name': _('Cash'),
                'type': 'cash',
                'code': _('CSH'),
                'company_id': company.id,
            },
            {
                'name': _('Bank'),
                'type': 'bank',
                'code': _('BNK'),
                'company_id': company.id,
            },
            {
                'name': _('Customer Invoices'),
                'type': 'sale',
                'code': _('INV'),
                'show_on_dashboard': True,
                'color': 11,
                'sequence': 5,
                'default_account_id': income_account_id,
                'company_id': company.id,
            },
            {
                'name': _('Vendor Bills'),
                'type': 'purchase',
                'code': _('BILL'),
                'show_on_dashboard': True,
                'color': 11,
                'sequence': 6,
                'default_account_id': expense_account_id,
                'company_id': company.id,
            },
            {
                'name': _('Miscellaneous Operations'),
                'type': 'general',
                'code': _('MISC'),
                'show_on_dashboard': True,
                'sequence': 7,
                'company_id': company.id,
            },
            {
                'name': _('Exchange Difference'),
                'type': 'general',
                'code': _('EXCH'),
                'sequence': 9,
                'company_id': company.id,
            },
            {
                'name': _('Cash Basis Taxes'),
                'type': 'general',
                'code': _('CABA'),
                'sequence': 10,
                'company_id': company.id,
            },
        ]

    def _create_properties(self, company, loaded_data):
        self.ensure_one()
        accounts_mapping = loaded_data['account.account.template']['records']

        to_create = [
            ('property_account_receivable_id', 'res.partner'),
            ('property_account_payable_id', 'res.partner'),
            ('property_account_expense_categ_id', 'product.category'),
            ('property_account_income_categ_id', 'product.category'),
            ('property_account_expense_id', 'product.template'),
            ('property_account_income_id', 'product.template'),
            ('property_tax_payable_account_id', 'account.tax.group'),
            ('property_tax_receivable_account_id', 'account.tax.group'),
            ('property_advance_tax_payment_account_id', 'account.tax.group'),
        ]
        for field_name, model_name in to_create:
            if not self[field_name]:
                continue

            account = accounts_mapping[self[field_name]]
            self.env['ir.property']._set_default(field_name, model_name, account, company=company)

    def _update_company_after_loading(self, company, loaded_data):
        self.ensure_one()
        accounts_mapping = loaded_data['account.account.template']['records']

        to_write = {
            'currency_id': self.currency_id.id,
            'anglo_saxon_accounting': self.use_anglo_saxon,
            'bank_account_code_prefix': self.bank_account_code_prefix,
            'cash_account_code_prefix': self.cash_account_code_prefix,
            'transfer_account_code_prefix': self.transfer_account_code_prefix,
            'chart_template_id': self.id,
        }

        # ==== Accounts ====

        for account_field, company_field in (
                ('property_cash_basis_base_account_id', 'account_cash_basis_base_account_id'),
                ('default_pos_receivable_account_id', 'account_default_pos_receivable_account_id'),
                ('income_currency_exchange_account_id', 'income_currency_exchange_account_id'),
                ('expense_currency_exchange_account_id', 'expense_currency_exchange_account_id'),
                ('account_journal_suspense_account_id', 'account_journal_suspense_account_id'),
                ('default_cash_difference_income_account_id', 'default_cash_difference_income_account_id'),
                ('default_cash_difference_expense_account_id', 'default_cash_difference_expense_account_id'),
                ('property_stock_account_input_categ_id', 'property_stock_account_input_categ_id'),
                ('property_stock_account_output_categ_id', 'property_stock_account_output_categ_id'),
                ('property_stock_valuation_account_id', 'property_stock_valuation_account_id'),
        ):
            if self[account_field]:
                to_write[company_field] = accounts_mapping[self[account_field]].id
            else:
                to_write[company_field] = False

        if not to_write['account_journal_suspense_account_id']:
            to_write['account_journal_suspense_account_id'] = self.env['account.account'].create({
                'name': _("Bank Suspense Account"),
                'code': self.env['account.account']._search_new_account_code(company, self.code_digits, self.bank_account_code_prefix),
                'user_type_id': self.env.ref('account.data_account_type_current_assets').id,
                'company_id': company.id,
            }).id

        if not to_write['default_cash_difference_expense_account_id']:
            to_write['default_cash_difference_expense_account_id'] = self.env['account.account'].create({
                'name': _('Cash Difference Loss'),
                'code': self.env['account.account']._search_new_account_code(company, self.code_digits, '999'),
                'user_type_id': self.env.ref('account.data_account_type_expenses').id,
                'tag_ids': [(6, 0, self.env.ref('account.account_tag_investing').ids)],
                'company_id': company.id,
            }).id

        if not to_write['default_cash_difference_expense_account_id']:
            to_write['default_cash_difference_expense_account_id'] = self.env['account.account'].create({
                'name': _('Cash Difference Gain'),
                'code': self.env['account.account']._search_new_account_code(company, self.code_digits, '999'),
                'user_type_id': self.env.ref('account.data_account_type_revenue').id,
                'tag_ids': [(6, 0, self.env.ref('account.account_tag_investing').ids)],
                'company_id': company.id,
            }).id

        to_write['transfer_account_id'] = self.env['account.account'].create({
            'name': _('Liquidity Transfer'),
            'code': self.env['account.account']._search_new_account_code(company, self.code_digits, self.transfer_account_code_prefix),
            'user_type_id': self.env.ref('account.data_account_type_current_assets').id,
            'reconcile': True,
            'company_id': company.id,
        }).id

        # Default taxes on the company
        to_write['account_sale_tax_id'] = self.env['account.tax'].search([
            ('type_tax_use', '=', 'sale'),
            ('company_id', '=', company.id),
        ], limit=1).id
        to_write['account_purchase_tax_id'] = self.env['account.tax'].search([
            ('type_tax_use', '=', 'purchase'),
            ('company_id', '=', company.id),
        ], limit=1).id

        # Unaffected earnings account.
        company.get_unaffected_earnings_account()

        company.write(to_write)

    def _load_coa(self, company):
        # Cleanup existing accounting.
        self._cleanup_existing_accounting(company)

        # Ensure the coa currency is active.
        if not self.currency_id.active:
            self.currency_id.active = True

        # When we install the CoA of first company, set the currency to price types and pricelists.
        # TODO: cleanup this part but how???
        if company.id == 1:
            for reference in ['product.list_price', 'product.standard_price', 'product.list0']:
                record = self.env.ref(reference, raise_if_not_found=False)
                if record:
                    record.currency_id = self.currency_id

        # Install all the templates objects and generate the real objects
        loaded_data = self._install_coa(company)

        # Update company.
        self._update_company_after_loading(company, loaded_data)

        # Journals.
        to_write_on_company = {}
        for journal in self.env['account.journal'].create(self._prepare_journals(company, loaded_data)):
            if journal.type == 'general' and journal.code == _('EXCH'):
                to_write_on_company['currency_exchange_journal_id'] = journal.id
            elif journal.type == 'general' and journal.code == _('CABA'):
                to_write_on_company['tax_cash_basis_journal_id'] = journal.id

        # Properties.
        self._create_properties(company, loaded_data)

        company.write(to_write_on_company)

        # Create a default rule for the reconciliation widget matching invoices automatically.
        self.env['account.reconcile.model'].sudo().create({
            'name': _("Invoices Matching Rule"),
            'sequence': 1,
            'rule_type': 'invoice_matching',
            'auto_reconcile': False,
            'match_nature': 'both',
            'match_same_currency': True,
            'match_total_amount': True,
            'match_total_amount_param': 100,
            'match_partner': True,
            'company_id': company.id,
        })

    def try_loading(self, company=None):
        """ Installs this chart of accounts for the current company if not chart
        of accounts had been created for it yet.
        """
        self.ensure_one()

        # Determine the company on which install the COA.
        if not company:
            if request and hasattr(request, 'allowed_company_ids'):
                company = self.env['res.company'].browse(request.allowed_company_ids[0])
            else:
                company = self.env.company

        if company.chart_template_id:
            return

        # Check access rights.
        if not self.env.is_admin():
            raise AccessError(_("Only administrators can load a chart of accounts"))

        # Check accounting journal items.
        if self.existing_accounting(company):
            raise UserError(_("Could not install new chart of account as there are already accounting entries existing."))

        # Ensure everything is translated to the company's language, not the user's one.
        self = self.with_context(lang=company.partner_id.lang).with_company(company)

        return self._load_coa(company)

    # -------------------------------------------------------------------------
    # ACTIONS
    # -------------------------------------------------------------------------

    def open_select_template_wizard(self):
        # Add action to open wizard to select between several templates
        if not self.company_id.chart_template_id:
            todo = self.env['ir.actions.todo']
            action_rec = self.env['ir.model.data'].xmlid_to_object('account.action_wizard_multi_chart')
            if action_rec:
                todo.create({'action_id': action_rec.id, 'name': _('Choose Accounting Template')})
        return True


class AccountTaxTemplate(models.Model):
    _name = 'account.tax.template'
    _description = 'Templates for Taxes'
    _order = 'id'

    chart_template_id = fields.Many2one('account.chart.template', string='Chart Template', required=True)

    name = fields.Char(string='Tax Name', required=True)
    type_tax_use = fields.Selection(TYPE_TAX_USE, string='Tax Type', required=True, default="sale",
        help="Determines where the tax is selectable. Note : 'None' means a tax can't be used by itself, however it can still be used in a group.")
    tax_scope = fields.Selection([('service', 'Service'), ('consu', 'Consumable')], help="Restrict the use of taxes to a type of product.")
    amount_type = fields.Selection(default='percent', string="Tax Computation", required=True,
        selection=[('group', 'Group of Taxes'), ('fixed', 'Fixed'), ('percent', 'Percentage of Price'), ('division', 'Percentage of Price Tax Included')])
    active = fields.Boolean(default=True, help="Set active to false to hide the tax without removing it.")
    children_tax_ids = fields.Many2many('account.tax.template', 'account_tax_template_filiation_rel', 'parent_tax', 'child_tax', string='Children Taxes')
    sequence = fields.Integer(required=True, default=1,
        help="The sequence field is used to define order in which the tax lines are applied.")
    amount = fields.Float(required=True, digits=(16, 4), default=0)
    description = fields.Char(string='Display on Invoices')
    price_include = fields.Boolean(string='Included in Price', default=False,
        help="Check this if the price you use on the product and invoices includes this tax.")
    include_base_amount = fields.Boolean(string='Affect Subsequent Taxes', default=False,
        help="If set, taxes which are computed after this one will be computed based on the price tax included.")
    analytic = fields.Boolean(string="Analytic Cost", help="If set, the amount computed by this tax will be assigned to the same analytic account as the invoice line (if any)")
    invoice_repartition_line_ids = fields.One2many(string="Repartition for Invoices", comodel_name="account.tax.repartition.line.template", inverse_name="invoice_tax_id", copy=True, help="Repartition when the tax is used on an invoice")
    refund_repartition_line_ids = fields.One2many(string="Repartition for Refund Invoices", comodel_name="account.tax.repartition.line.template", inverse_name="refund_tax_id", copy=True, help="Repartition when the tax is used on a refund")
    tax_group_id = fields.Many2one('account.tax.group', string="Tax Group")
    tax_exigibility = fields.Selection(
        [('on_invoice', 'Based on Invoice'),
         ('on_payment', 'Based on Payment'),
        ], string='Tax Due', default='on_invoice',
        help="Based on Invoice: the tax is due as soon as the invoice is validated.\n"
        "Based on Payment: the tax is due as soon as the payment of the invoice is received.")
    cash_basis_transition_account_id = fields.Many2one(
        comodel_name='account.account.template',
        string="Cash Basis Transition Account",
        domain=[('deprecated', '=', False)],
        help="Account used to transition the tax amount for cash basis taxes. It will contain the tax amount as long as the original invoice has not been reconciled ; at reconciliation, this amount cancelled on this account and put on the regular tax account.")

    _sql_constraints = [
        ('name_company_uniq', 'unique(name, type_tax_use, tax_scope, chart_template_id)', 'Tax names must be unique !'),
    ]

    @api.depends('name', 'description')
    def name_get(self):
        res = []
        for record in self:
            name = record.description and record.description or record.name
            res.append((record.id, name))
        return res


class AccountTaxRepartitionLineTemplate(models.Model):
    _name = "account.tax.repartition.line.template"
    _description = "Tax Repartition Line Template"

    factor_percent = fields.Float(string="%", required=True, help="Factor to apply on the account move lines generated from this distribution line, in percents")
    repartition_type = fields.Selection(string="Based On", selection=[('base', 'Base'), ('tax', 'of tax')], required=True, default='tax', help="Base on which the factor will be applied.")
    account_id = fields.Many2one(string="Account", comodel_name='account.account.template', help="Account on which to post the tax amount")
    invoice_tax_id = fields.Many2one(comodel_name='account.tax.template', help="The tax set to apply this distribution on invoices. Mutually exclusive with refund_tax_id")
    refund_tax_id = fields.Many2one(comodel_name='account.tax.template', help="The tax set to apply this distribution on refund invoices. Mutually exclusive with invoice_tax_id")
    tag_ids = fields.Many2many(string="Financial Tags", relation='account_tax_repartition_financial_tags', comodel_name='account.account.tag', copy=True, help="Additional tags that will be assigned by this repartition line for use in financial reports")
    use_in_tax_closing = fields.Boolean(string="Tax Closing Entry")

    # These last two fields are helpers used to ease the declaration of account.account.tag objects in XML.
    # They are directly linked to account.tax.report.line objects, which create corresponding + and - tags
    # at creation. This way, we avoid declaring + and - separately every time.
    plus_report_line_ids = fields.Many2many(string="Plus Tax Report Lines", relation='account_tax_repartition_plus_report_line', comodel_name='account.tax.report.line', copy=True, help="Tax report lines whose '+' tag will be assigned to move lines by this repartition line")
    minus_report_line_ids = fields.Many2many(string="Minus Report Lines", relation='account_tax_repartition_minus_report_line', comodel_name='account.tax.report.line', copy=True, help="Tax report lines whose '-' tag will be assigned to move lines by this repartition line")

    @api.model
    def create(self, vals):
        if vals.get('plus_report_line_ids'):
            vals['plus_report_line_ids'] = self._convert_tag_syntax_to_orm(vals['plus_report_line_ids'])

        if vals.get('minus_report_line_ids'):
            vals['minus_report_line_ids'] = self._convert_tag_syntax_to_orm(vals['minus_report_line_ids'])

        if vals.get('tag_ids'):
            vals['tag_ids'] = self._convert_tag_syntax_to_orm(vals['tag_ids'])

        if vals.get('use_in_tax_closing') is None:
            if not vals.get('account_id'):
                vals['use_in_tax_closing'] = False
            else:
                internal_group = self.env['account.account.template'].browse(vals.get('account_id')).user_type_id.internal_group
                vals['use_in_tax_closing'] = not (internal_group == 'income' or internal_group == 'expense')

        return super(AccountTaxRepartitionLineTemplate, self).create(vals)

    @api.model
    def _convert_tag_syntax_to_orm(self, tags_list):
        """ Repartition lines give the possibility to directly give
        a list of ids to create for tags instead of a list of ORM commands.

        This function checks that tags_list uses this syntactic sugar and returns
        an ORM-compliant version of it if it does.
        """
        if tags_list and all(isinstance(elem, int) for elem in tags_list):
            return [(6, False, tags_list)]
        return tags_list

    @api.constrains('invoice_tax_id', 'refund_tax_id')
    def validate_tax_template_link(self):
        for record in self:
            if record.invoice_tax_id and record.refund_tax_id:
                raise ValidationError(_("Tax distribution line templates should apply to either invoices or refunds, not both at the same time. invoice_tax_id and refund_tax_id should not be set together."))

    @api.constrains('plus_report_line_ids', 'minus_report_line_ids')
    def validate_tags(self):
        all_tax_rep_lines = self.mapped('plus_report_line_ids') + self.mapped('minus_report_line_ids')
        lines_without_tag = all_tax_rep_lines.filtered(lambda x: not x.tag_name)
        if lines_without_tag:
            raise ValidationError(_("The following tax report lines are used in some tax distribution template though they don't generate any tag: %s . This probably means you forgot to set a tag_name on these lines.", str(lines_without_tag.mapped('name'))))

# Fiscal Position Templates

class AccountFiscalPositionTemplate(models.Model):
    _name = 'account.fiscal.position.template'
    _description = 'Template for Fiscal Position'

    sequence = fields.Integer()
    name = fields.Char(string='Fiscal Position Template', required=True)
    chart_template_id = fields.Many2one('account.chart.template', string='Chart Template', required=True)
    account_ids = fields.One2many('account.fiscal.position.account.template', 'position_id', string='Account Mapping')
    tax_ids = fields.One2many('account.fiscal.position.tax.template', 'position_id', string='Tax Mapping')
    note = fields.Text(string='Notes')
    auto_apply = fields.Boolean(string='Detect Automatically', help="Apply automatically this fiscal position.")
    vat_required = fields.Boolean(string='VAT required', help="Apply only if partner has a VAT number.")
    country_id = fields.Many2one('res.country', string='Country',
        help="Apply only if delivery country matches.")
    country_group_id = fields.Many2one('res.country.group', string='Country Group',
        help="Apply only if delivery country matches the group.")
    state_ids = fields.Many2many('res.country.state', string='Federal States')
    zip_from = fields.Char(string='Zip Range From')
    zip_to = fields.Char(string='Zip Range To')


class AccountFiscalPositionTaxTemplate(models.Model):
    _name = 'account.fiscal.position.tax.template'
    _description = 'Tax Mapping Template of Fiscal Position'
    _rec_name = 'position_id'

    position_id = fields.Many2one('account.fiscal.position.template', string='Fiscal Position', required=True, ondelete='cascade')
    tax_src_id = fields.Many2one('account.tax.template', string='Tax Source', required=True)
    tax_dest_id = fields.Many2one('account.tax.template', string='Replacement Tax')


class AccountFiscalPositionAccountTemplate(models.Model):
    _name = 'account.fiscal.position.account.template'
    _description = 'Accounts Mapping Template of Fiscal Position'
    _rec_name = 'position_id'

    position_id = fields.Many2one('account.fiscal.position.template', string='Fiscal Mapping', required=True, ondelete='cascade')
    account_src_id = fields.Many2one('account.account.template', string='Account Source', required=True)
    account_dest_id = fields.Many2one('account.account.template', string='Account Destination', required=True)


class AccountReconcileModelTemplate(models.Model):
    _name = "account.reconcile.model.template"
    _description = 'Reconcile Model Template'

    # Base fields.
    chart_template_id = fields.Many2one('account.chart.template', string='Chart Template', required=True)
    name = fields.Char(string='Button Label', required=True)
    sequence = fields.Integer(required=True, default=10)

    rule_type = fields.Selection(selection=[
        ('writeoff_button', 'Manually create a write-off on clicked button'),
        ('writeoff_suggestion', 'Suggest a write-off'),
        ('invoice_matching', 'Match existing invoices/bills')
    ], string='Type', default='writeoff_button', required=True)
    auto_reconcile = fields.Boolean(string='Auto-validate',
        help='Validate the statement line automatically (reconciliation based on your rule).')
    to_check = fields.Boolean(string='To Check', default=False, help='This matching rule is used when the user is not certain of all the information of the counterpart.')
    matching_order = fields.Selection(
        selection=[
            ('old_first', 'Oldest first'),
            ('new_first', 'Newest first'),
        ]
    )

    # ===== Conditions =====
    match_text_location_label = fields.Boolean(
        default=True,
        help="Search in the Statement's Label to find the Invoice/Payment's reference",
    )
    match_text_location_note = fields.Boolean(
        default=False,
        help="Search in the Statement's Note to find the Invoice/Payment's reference",
    )
    match_text_location_reference = fields.Boolean(
        default=False,
        help="Search in the Statement's Reference to find the Invoice/Payment's reference",
    )
    match_journal_ids = fields.Many2many('account.journal', string='Journals',
        domain="[('type', 'in', ('bank', 'cash'))]",
        help='The reconciliation model will only be available from the selected journals.')
    match_nature = fields.Selection(selection=[
        ('amount_received', 'Amount Received'),
        ('amount_paid', 'Amount Paid'),
        ('both', 'Amount Paid/Received')
    ], string='Amount Nature', required=True, default='both',
        help='''The reconciliation model will only be applied to the selected transaction type:
        * Amount Received: Only applied when receiving an amount.
        * Amount Paid: Only applied when paying an amount.
        * Amount Paid/Received: Applied in both cases.''')
    match_amount = fields.Selection(selection=[
        ('lower', 'Is Lower Than'),
        ('greater', 'Is Greater Than'),
        ('between', 'Is Between'),
    ], string='Amount',
        help='The reconciliation model will only be applied when the amount being lower than, greater than or between specified amount(s).')
    match_amount_min = fields.Float(string='Amount Min Parameter')
    match_amount_max = fields.Float(string='Amount Max Parameter')
    match_label = fields.Selection(selection=[
        ('contains', 'Contains'),
        ('not_contains', 'Not Contains'),
        ('match_regex', 'Match Regex'),
    ], string='Label', help='''The reconciliation model will only be applied when the label:
        * Contains: The proposition label must contains this string (case insensitive).
        * Not Contains: Negation of "Contains".
        * Match Regex: Define your own regular expression.''')
    match_label_param = fields.Char(string='Label Parameter')
    match_note = fields.Selection(selection=[
        ('contains', 'Contains'),
        ('not_contains', 'Not Contains'),
        ('match_regex', 'Match Regex'),
    ], string='Note', help='''The reconciliation model will only be applied when the note:
        * Contains: The proposition note must contains this string (case insensitive).
        * Not Contains: Negation of "Contains".
        * Match Regex: Define your own regular expression.''')
    match_note_param = fields.Char(string='Note Parameter')
    match_transaction_type = fields.Selection(selection=[
        ('contains', 'Contains'),
        ('not_contains', 'Not Contains'),
        ('match_regex', 'Match Regex'),
    ], string='Transaction Type', help='''The reconciliation model will only be applied when the transaction type:
        * Contains: The proposition transaction type must contains this string (case insensitive).
        * Not Contains: Negation of "Contains".
        * Match Regex: Define your own regular expression.''')
    match_transaction_type_param = fields.Char(string='Transaction Type Parameter')
    match_same_currency = fields.Boolean(string='Same Currency Matching', default=True,
        help='Restrict to propositions having the same currency as the statement line.')
    match_total_amount = fields.Boolean(string='Amount Matching', default=True,
        help='The sum of total residual amount propositions matches the statement line amount.')
    match_total_amount_param = fields.Float(string='Amount Matching %', default=100,
        help='The sum of total residual amount propositions matches the statement line amount under this percentage.')
    match_partner = fields.Boolean(string='Partner Is Set',
        help='The reconciliation model will only be applied when a customer/vendor is set.')
    match_partner_ids = fields.Many2many('res.partner', string='Restrict Partners to',
        help='The reconciliation model will only be applied to the selected customers/vendors.')
    match_partner_category_ids = fields.Many2many('res.partner.category', string='Restrict Partner Categories to',
        help='The reconciliation model will only be applied to the selected customer/vendor categories.')

    line_ids = fields.One2many('account.reconcile.model.line.template', 'model_id')
    decimal_separator = fields.Char(help="Every character that is nor a digit nor this separator will be removed from the matching string")


class AccountReconcileModelLineTemplate(models.Model):
    _name = "account.reconcile.model.line.template"
    _description = 'Reconcile Model Line Template'

    model_id = fields.Many2one('account.reconcile.model.template')
    sequence = fields.Integer(required=True, default=10)
    account_id = fields.Many2one('account.account.template', string='Account', ondelete='cascade', domain=[('deprecated', '=', False)])
    label = fields.Char(string='Journal Item Label')
    amount_type = fields.Selection([
        ('fixed', 'Fixed'),
        ('percentage', 'Percentage of balance'),
        ('regex', 'From label'),
    ], required=True, default='percentage')
    amount_string = fields.Char(string="Amount")
    force_tax_included = fields.Boolean(string='Tax Included in Price', help='Force the tax to be managed as a price included tax.')
    tax_ids = fields.Many2many('account.tax.template', string='Taxes', ondelete='restrict')
