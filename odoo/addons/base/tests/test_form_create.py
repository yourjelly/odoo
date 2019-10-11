# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
import re
from random import choice
from datetime import date

from odoo import fields
from odoo.tests import TransactionCase, Form, tagged


_logger = logging.getLogger(__name__)


@tagged('post_install', '-at_install')
class TestCreateForm(TransactionCase):
    def _get_all_models(self):
        # TODO : Some of those models might be tested using a specific method
        ignored_models = {
            'res.config.settings', # The test makes no sense for this model
            'phone.blacklist', # Requires a valid phone number ...
            'snailmail.letter', # Uses res_id and model fields and crashes if you set it to something not working # FIXME
            'sms.template.preview', # Cannot be created manually, some fields are required on the model but readonly in the view
            'sms.resend', # Cannot be created manually, mail_message_id is both required and readonly and can only be set via a default_mail_message_id key in the context
            'sms.resend.recipient', # Requires a sms.resend to be created ...
            'mail.tracking.value', # Some fields are both required and readonly
            'mail.followers', # Requires to set a partner_id or a channel_id but those fields are not in the form view
            'mail.notification', # Requires a partner_id, but this field is not required in the database?? # FIXME
            'mail.activity', # Uses a Many2oneReference which is not easy to automatize # TODO
            'mail.mail', # Requires a valid email address
            'mail.blacklist', # Requires a valid email address
            'mail.resend.message', # Requires a default_mail_message_id context key
            'change.password.user', # Technical model
            'resource.test', # Test model
            'account.partial.reconcile', # Requires a default_move_id in the context
            'account.bank.statement.import.journal.creation', # FIXME This model is broken in the tests
            'portal.share', # res_model, res_id
            'hr.payslip.employee.depature.holiday.attests', # Must be logged in a belgian company
            'hr.payslip.employee.depature.notice', # Must be logged in a belgian company
            'hr.payroll.281.10.wizard', # Must be logged in a belgian company
            'hr.payroll.281.45.wizard', # Must be logged in a belgian company
            'hr.payroll.alloc.paid.leave', # Must be logged in a belgian company
        }
        # sms.composer -> Fixed
        # sms.template.preview -> Fixed (wrong compute + check for missing info)
        # account.bank.statement.cashbox -> Fixed (wrong compute)
        # portal.share -> default_get should not try self.env[None] + compute
        # account.payment.register -> default_get should check that you have active_ids
        # fleet.vehicle.cost -> Fixed compute method
        # account.reconcile.model.template -> Fixed : remove compute field that has no compute method
        # theme.ir.ui.view -> Fixed -- check if install_filename is in context
        # theme.website.page ?
        # helpdesk.sla.status -> Fixed -- compute_status wasn't checking if deadline is set or not and comparing a boolean to a datetime
        # sale.order.line -> Fixed -- so_line.name can be False, we have to check before trying to split a boolean
        # stock.overprocessed.transfer -> Fixed -- check that we have a picking_id set on the wizard before trying to call _get_overprocessed_stock_moves
        # iot.box -> Fixed -- check that we have an ip on the iot.box because it is not required
        # rental.wizard -> Fixed -- compute without default value
        # l10n_be_reports.periodic.vat.xml.export -> Fixed -- use dict as default value in get instead of None

        # FIXME Those most probably require a fix to work
        unsure = {
            'mail.compose.message', # AssertionError: This domain is syntactically not correct: ['|', ['composition_mode', '!=', 'mass_post']]
            'resource.calendar.attendance', # calendar_id is not in the view
            'account.batch.payment', # odoo.exceptions.CacheMiss: ('account.payment(1,).name', None) # FIXME There is something strange about this one, but I have no idea what as the stacktrace is not useful
            'mrp.bom.byproduct', # WARNING form odoo.tests.common.onchange: Warning The unit of measure you choose is in a different category than the product unit of measure.
            'mrp.bom', # same as above
        }
        # These should all be defined in their own method as they require specific input to work
        validation_error = {
            'account_reports.export.wizard', # KeyError: hello
            'account_reports.export.wizard.format', # KeyError: hello

            'mrp.workorder', # AssertionError: precision_rounding must be positive, got 0.0

            'gamification.badge.user', # odoo.exceptions.ValidationError: ('The selected employee does not correspond to the selected user.', None)
            'calendar.event', # odoo.exceptions.ValidationError: ("The ending date and time cannot be earlier than the starting date and time.\nMeeting 'hello' starts '2019-10-10 11:39:46' and ends '2019-10-10 11:39:45'", None)
            'uom.uom', # odoo.exceptions.ValidationError: ('UoM category Unit should only have one reference unit of measure.', None)
            'stock.inventory.line', # odoo.exceptions.ValidationError: ('You can only adjust storable products.\n\nhello -> consu', None)
            'account.analytic.line', # odoo.exceptions.ValidationError: ("The selected account belongs to another company that the one you're trying to create an analytic item for", None)
            'account.transfer.model', # odoo.exceptions.ValidationError: ('The total percentage (0.0) should be less or equal to 100 !', None)
            'payment.link.wizard', # odoo.exceptions.ValidationError: ('The value of the payment amount must be positive.', None)
            'product.attribute.custom.value', # odoo.exceptions.ValidationError: ('The attribute hello must have at least one value for the product hello.', None)

            'hr.leave', # psycopg2.errors.CheckViolation: new row for relation "hr_leave" violates check constraint "hr_leave_type_value"
            'rental.order.wizard.line', # psycopg2.errors.CheckViolation: new row for relation "sale_order_line" violates check constraint "sale_order_line_accountable_required_fields"

            'stock.warehouse', # psycopg2.errors.UniqueViolation: duplicate key value violates unique constraint "stock_warehouse_warehouse_name_uniq"
            'account.tax', # psycopg2.errors.UniqueViolation: duplicate key value violates unique constraint "account_tax_name_company_uniq"
            'account.setup.bank.manual.config', # psycopg2.errors.UniqueViolation: duplicate key value violates unique constraint "res_partner_bank_unique_number"

            'stock.move', # odoo.exceptions.UserError: ('You cannot perform the move because the unit of measure has a different category as the product unit of measure.\n\nhello --> Product UoM is Units (Unit) - Move UoM is Days (Working Time)\n\nBlocking: hello', '')
            'stock.assign.serial', # odoo.exceptions.UserError: ('You cannot perform the move because the unit of measure has a different category as the product unit of measure.\n\nhello --> Product UoM is Units (Unit) - Move UoM is Days (Working Time)\n\nBlocking: hello', '')
            'mrp.product.produce', # odoo.exceptions.UserError: ('You have to produce at least one False.', '')
            'mrp.production', # odoo.exceptions.UserError: ("The unit of measure Days defined on the order line doesn't belong to the same category than the unit of measure Units defined on the product. Please correct the unit of measure defined on the order line or on the product, they should belong to the same category.", ')'

            'account.move', # odoo.exceptions.UserError: ('Please define an accounting miscellaneous journal in your company', '')
            'account.move.line', # odoo.exceptions.UserError: ('Please define an accounting miscellaneous journal in your company', '')

            'account.accrual.accounting.wizard', # odoo.exceptions.UserError: ('This can only be used on journal items', '')
            'account.invoice.send', # odoo.exceptions.UserError: ('You can only send invoices.', '')
        }
        # TODO These most probably need a specific method, because they probably remove the value of a required field via an onchange
        required_field_problem = {
            'rental.wizard', # AssertionError: product_id is a required field
            'sale.order.line', # AssertionError: order_id is a required field
            'account.payment', # AssertionError: destination_journal_id is a required field
            'stock.quant', # AssertionError: product_id is a required field
            'stock.rule', # AssertionError: location_src_id is a required field
            'hr.leave.allocation', # AssertionError: holiday_status_id is a required field
            'sign.send.request.signer', # AssertionError: role_id is a required field
            'website.track', # AssertionError: visitor_id is a required field
            'hr.payslip', # AssertionError: struct_id is a required field
            'portal.wizard.user', # AssertionError: partner_id is a required field
            'account.asset', # AssertionError: book_value is a required field
            'iot.device', # AssertionError: iot_id is a required field
            'stock.picking.type', # AssertionError: default_location_src_id is a required field
            'stock.warn.insufficient.qty.scrap', # AssertionError: product_id is a required field
            'product.replenish', # AssertionError: product_id is a required field
            'payment.transaction', # AssertionError: acquirer_id is a required field
            #-------------------------------------------------------------------------------------------------------------------------------------------
            'hr.work.entry', # psycopg2.errors.NotNullViolation: null value in column "contract_id" violates not-null constraint
            'sign.request.item', # psycopg2.errors.NotNullViolation: null value in column "sign_request_id" violates not-null constraint
            'sign.item', # psycopg2.errors.NotNullViolation: null value in column "template_id" violates not-null constraint
            'product.template.attribute.value', # ERROR: null value in column "product_attribute_value_id" violates not-null constraint
            'product.template.attribute.line', # psycopg2.errors.NotNullViolation: null value in column "product_tmpl_id" violates not-null constraint
            'account.account.type', # psycopg2.errors.NotNullViolation: null value in column "internal_group" violates not-null constraint
            'account.tax.report.line', # psycopg2.errors.NotNullViolation: null value in column "country_id" violates not-null constraint
            'account.payment.term.line', # psycopg2.errors.NotNullViolation: null value in column "payment_id" violates not-null constraint
            'account.bank.statement.line', # psycopg2.errors.NotNullViolation: null value in column "journal_id" violates not-null constraint
            'account.chart.template', # psycopg2.errors.NotNullViolation: null value in column "currency_id" violates not-null constraint
            'account.tax.template', # psycopg2.errors.NotNullViolation: null value in column "chart_template_id" violates not-null constraint
            'account.batch.download.wizard', # psycopg2.errors.NotNullViolation: null value in column "batch_payment_id" violates not-null constraint
            'documents.share', # psycopg2.errors.NotNullViolation: null value in column "folder_id" violates not-null constraint
            'sign.template.share', # psycopg2.errors.NotNullViolation: null value in column "template_id" violates not-null constraint
            'hr.payslip.line', # psycopg2.errors.NotNullViolation: null value in column "name" violates not-null constraint
            'hr.payslip.worked_days', # psycopg2.errors.NotNullViolation: null value in column "name" violates not-null constraint
            'hr.payslip.input', # psycopg2.errors.NotNullViolation: null value in column "name" violates not-null constraint
            'account.financial.html.report', # psycopg2.errors.NotNullViolation: null value in column "name" violates not-null constraint
            'mrp.routing.workcenter', # psycopg2.errors.NotNullViolation: null value in column "routing_id" violates not-null constraint
            'change.production.qty', # psycopg2.errors.NotNullViolation: null value in column "product_id" violates not-null constraint
            'quality.check', # psycopg2.errors.NotNullViolation: null value in column "test_type_id" violates not-null constraint
            'stock.package.destination', # psycopg2.errors.NotNullViolation: null value in column "picking_id" violates not-null constraint
            'mrp.bom.line', # psycopg2.errors.NotNullViolation: null value in column "bom_id" violates not-null constraint
            'rating.rating', # psycopg2.errors.NotNullViolation: null value in column "res_id" violates not-null constraint
            'asset.modify', # psycopg2.errors.NotNullViolation: null value in column "name" violates not-null constraint
            'account.asset.pause', # psycopg2.errors.NotNullViolation: null value in column "asset_id" violates not-null constraint
            'account.asset.sell', # psycopg2.errors.NotNullViolation: null value in column "asset_id" violates not-null constraint
        }
        # FIXME Those should work fine, some might be the same case than above
        company_id = {
            'account.financial.year.op', # psycopg2.errors.NotNullViolation: null value in column "company_id" violates not-null constraint
            'stock.valuation.layer', # AssertionError: company_id is a required field
            'stock.package_level', # AssertionError: company_id is a required field
            'stock.move.line', # psycopg2.errors.NotNullViolation: null value in column "company_id" violates not-null constraint
            'stock.production.lot', # AssertionError: company_id is a required field
        }
        # FIXME We have to support the One2many and Many2many fields in order for these to work
        o2m_m2m_manipulate = {
            'account.common.report', # AssertionError: Can't set an o2m or m2m field, manipulate the corresponding proxies
            'account.common.journal.report', # AssertionError: Can't set an o2m or m2m field, manipulate the corresponding proxies
            'account.print.journal', # AssertionError: Can't set an o2m or m2m field, manipulate the corresponding proxies
            'account.bank.statement.import', # AssertionError: Can't set an o2m or m2m field, manipulate the corresponding proxies
            'hr.payslip.employees',
            'gamification.challenge',
            'stock.rules.report',
        }
        # We ignore all models starting by because they are technical and should probably never be created by a user # TODO Add a whitelist?
        # - ir
        # - base
        # - base_import
        # - test_testing_utilities
        # - test_new_api
        # - l10n_be
        technical_regex = re.compile(r'^(ir|base|base_import|test_testing_utilities|test_new_api|l10n_be)\.')

        for model in self.env.keys():
            should_be_ignored = bool(technical_regex.match(model))
            if model not in (validation_error | required_field_problem | company_id | o2m_m2m_manipulate | ignored_models | unsure) and not should_be_ignored:
                Model = self.env[model]
                if Model._auto:
                    yield Model

    def _get_required_model_fields(self, form, model):
        # Don't update company_id, it should be handled via default values and onchanges
        ignored_fields = {'company_id', 'standard_price'}

        for fname, field in model._fields.items():
            if fname in ignored_fields:
                continue

            if form:
                try:
                    getattr(form, fname)
                except AssertionError:
                    continue

            if field.company_dependent:
                yield fname, field
                continue

            if (form and not form._view['fields'].get(fname)):
                continue

            try:
                is_required = form._get_modifier(fname, 'required') if form else field.required
            except KeyError:
                is_required = False

            try:
                is_readonly = form._get_modifier(fname, 'readonly') if form else field.readonly
            except KeyError:
                is_readonly = False

            if not is_readonly and is_required:
                yield fname, field

    def _create_record(self, model_name):
        Model = self.env[model_name]
        values = {
            fname: self._generate_value_for_field(None, field, Model)
            for fname, field in self._get_required_model_fields(None, Model)
        }
        return Model.create(values)

    def _create_hr_leave(self):
        leave_form = Form(self.env['hr.leave'])
        leave_form.employee_id = self.env['hr.employee'].create({'name': 'Boris'})
        leave_form.holiday_status_id = self.env['hr.leave.type'].create({
            'name': 'Boris time off 2012',
            'allocation_type': 'no',
        })
        leave_form.request_date_from = date(2019, 10, 8)
        leave_form.request_date_to = date(2019, 10, 10)
        leave_form.save()

    def _generate_value_for_field(self, form, field, model, generate_id=True):
        ftype = field.type
        value = False

        default = field.default(model) if callable(field.default) else field.default

        if ftype in ['char', 'text']:
            value = default or 'hello'
        elif ftype == 'many2one':
            Comodel = self.env[field.comodel_name]

            if default:
                value = Comodel.browse(default) if isinstance(default, int) else default
            else:
                record = Comodel.search([], limit=1)
                if not record:
                    record = self._create_record(field.comodel_name)
                value = record
            if generate_id:
                value = value.id
        elif ftype == 'selection':
            selection = field.selection(model) if callable(field.selection) else field.selection
            value = default or choice(selection)[0]
        elif ftype == 'integer':
            value = default or 42
        elif ftype == 'date':
            value = default or fields.Date.today()
        elif ftype == 'datetime':
            value = default or fields.Datetime.now()
        elif ftype == 'many2many':
            record = self.env[field.comodel_name].search([], limit=1)
            if not record:
                record = self._create_record(field.comodel_name)
            value = default or [(6, 0, record.ids)]
        elif ftype == 'one2many':
            record = self.env[field.comodel_name].search([], limit=1)
            if not record:
                record = self._create_record(field.comodel_name)
            value = default or [(4, 0, record.id)]
        elif ftype == 'float':
            value = default or 5.0
        elif ftype == 'monetary':
            value = default or 0.56
        elif ftype == 'boolean':
            value = False
        else:
            raise ValueError('%s not handled for field %s for model %s' % (ftype, field, form))

        return value

    def test_all_models_creation_using_form(self):
        for model in self._get_all_models():
            _logger.info('Testing model %s', model)
            method_name = '_create_%s' % model._table
            if hasattr(self, method_name):
                getattr(self, method_name)()
            else:
                model_form = Form(model)
                for fname, field in self._get_required_model_fields(model_form, model):
                    value = self._generate_value_for_field(model_form, field, model, generate_id=False)
                    setattr(model_form, fname, value)
                model_form.save()
