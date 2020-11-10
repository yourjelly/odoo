# -*- coding: utf-8 -*-

from odoo.exceptions import AccessError
from odoo import api, fields, models, _
from odoo import SUPERUSER_ID
from odoo.exceptions import UserError
from odoo.http import request
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
